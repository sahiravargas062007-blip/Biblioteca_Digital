const bcrypt = require("bcryptjs");
const Usuario = require("../../models/Usuario");
const Administrador = require("../../models/Administrador");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${process.env.APP_URL || "http://localhost:3000"}/auth/google/callback`,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const correo = profile.emails[0].value.toLowerCase();
          let admin = await Administrador.findOne({ correo, activo: true });
          if (admin)
            return done(null, {
              ...admin.toObject(),
              authRol: "administrador",
            });

          let usuario = await Usuario.findOne({ correo });
          if (usuario) {
            if (!usuario.emailVerified) {
              usuario.emailVerified = true;
              usuario.estado = "Activo";
              await usuario.save();
            }
            return done(null, { ...usuario.toObject(), authRol: "usuario" });
          }

          const nuevoUsuario = await Usuario.create({
            nombre: profile.displayName,
            correo: correo,
            emailVerified: true,
            estado: "Activo",
          });
          return done(null, { ...nuevoUsuario.toObject(), authRol: "usuario" });
        } catch (err) {
          return done(err, null);
        }
      },
    ),
  );
}

function flash(req, type, message) {
  req.session.flash = { type, message };
}

// Configuración de correo
async function sendEmail(to, subject, text) {
  let transporter;
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    // Cuenta de prueba en consola
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
  }

  try {
    const fromEmail =
      process.env.SMTP_FROM ||
      process.env.SMTP_USER ||
      "noreply@biblionet.teamfusion.site";
    const info = await transporter.sendMail({
      from: `"BiblioNet" <${fromEmail}>`,
      to,
      subject,
      text,
    });

    if (!process.env.SMTP_HOST) {
      console.log("--- EMAIL SIMULADO ---");
      console.log("To:", to);
      console.log("Subject:", subject);
      console.log("Mensaje:", text);
      console.log(
        "URL de previsualización:",
        nodemailer.getTestMessageUrl(info),
      );
      console.log("----------------------");
    }
  } catch (error) {
    console.error("Error al enviar el correo SMTP:", error.message);
    throw new Error("SMTP_ERROR");
  }
}

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6 dígitos
}

const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_])[A-Za-z\d\W_]{8,20}$/;

exports.registerForm = (req, res) => {
  const formData = req.session.formData || {};
  req.session.formData = null;
  res.render("auth/index", {
    title: "Registro",
    layout: false,
    formData,
    activeForm: "register",
  });
};

exports.register = async (req, res, next) => {
  try {
    const { nombre, correo, telefono, password, confirmPassword } = req.body;
    const correoLower = String(correo || "")
      .toLowerCase()
      .trim();

    if (password !== confirmPassword) {
      flash(req, "error", "Las contraseñas no coinciden.");
      req.session.formData = { nombre, correo, telefono };
      return res.redirect("/registro");
    }

    if (!PASSWORD_REGEX.test(password)) {
      flash(
        req,
        "error",
        "La contraseña debe tener entre 8 y 20 caracteres, una mayúscula, una minúscula, un número y un carácter especial.",
      );
      req.session.formData = { nombre, correo, telefono };
      return res.redirect("/registro");
    }

    const existeAdmin = await Administrador.findOne({ correo: correoLower });
    const existeUsuario = await Usuario.findOne({ correo: correoLower });

    if (existeAdmin || existeUsuario) {
      flash(
        req,
        "error",
        "Este correo ya está registrado. Si olvidaste tu contraseña, puedes recuperarla.",
      );
      req.session.formData = { nombre, telefono }; // Don't send back email to encourage them to reset
      return res.redirect("/registro");
    }

    const codigo = generateCode();
    const hashPassword = await bcrypt.hash(password, 12);

    const nuevoUsuario = await Usuario.create({
      nombre,
      correo: correoLower,
      telefono,
      password_hash: hashPassword,
      estado: "No Verificado",
      emailVerified: false,
      verificationCode: await bcrypt.hash(codigo, 10),
      verificationCodeExpires: Date.now() + 600000, // 10 mins
      creado_en: new Date(),
      actualizado_en: new Date(),
    });

    try {
      await sendEmail(
        correoLower,
        "Verifica tu cuenta en BiblioNet",
        `Tu código de verificación es: ${codigo}\n\nEste código caduca en 10 minutos.`,
      );
    } catch (emailError) {
      flash(
        req,
        "error",
        "Cuenta creada, pero hubo un error al enviar el correo. Por favor contacta soporte.",
      );
      return res.redirect("/login");
    }

    // Guardar ID temporal en sesión para la verificación
    req.session.tempUserId = nuevoUsuario._id;
    flash(
      req,
      "success",
      `Cuenta creada. Hemos enviado un código de verificación a tu correo: ${correoLower}`,
    );
    res.redirect("/verificar-correo");
  } catch (error) {
    next(error);
  }
};

exports.verifyEmailForm = (req, res) => {
  if (!req.session.tempUserId) return res.redirect("/login");
  res.render("auth/index", {
    title: "Verificar Correo",
    layout: false,
    activeForm: "verifyEmail",
  });
};

exports.verifyEmail = async (req, res, next) => {
  try {
    const codigo = String(req.body.codigo || "").trim();
    if (!req.session.tempUserId) return res.redirect("/login");

    const usuario = await Usuario.findById(req.session.tempUserId);
    if (!usuario) return res.redirect("/login");

    if (usuario.emailVerified) {
      flash(req, "info", "Tu cuenta ya está verificada. Inicia sesión.");
      return res.redirect("/login");
    }

    if (
      !usuario.verificationCodeExpires ||
      Date.now() > usuario.verificationCodeExpires
    ) {
      flash(
        req,
        "error",
        "El código ha expirado. Por favor, solicita uno nuevo.",
      );
      return res.redirect("/verificar-correo");
    }

    if (usuario.verificationAttempts >= 5) {
      flash(
        req,
        "error",
        "Demasiados intentos fallidos. Solicita un código nuevo más tarde.",
      );
      return res.redirect("/verificar-correo");
    }

    const isMatch = await bcrypt.compare(codigo, usuario.verificationCode);
    if (!isMatch) {
      usuario.verificationAttempts += 1;
      await usuario.save();
      flash(req, "error", "Código incorrecto.");
      return res.redirect("/verificar-correo");
    }

    usuario.emailVerified = true;
    usuario.estado = "Activo";
    usuario.verificationCode = undefined;
    usuario.verificationCodeExpires = undefined;
    usuario.verificationAttempts = 0;
    await usuario.save();

    delete req.session.tempUserId;
    flash(
      req,
      "success",
      "Cuenta verificada exitosamente. Ahora puedes iniciar sesión.",
    );
    res.redirect("/login");
  } catch (error) {
    next(error);
  }
};

exports.resendVerificationCode = async (req, res, next) => {
  try {
    if (!req.session.tempUserId) return res.redirect("/login");
    const usuario = await Usuario.findById(req.session.tempUserId);
    if (!usuario || usuario.emailVerified) return res.redirect("/login");

    const codigo = generateCode();
    usuario.verificationCode = await bcrypt.hash(codigo, 10);
    usuario.verificationCodeExpires = Date.now() + 600000;
    usuario.verificationAttempts = 0;
    await usuario.save();

    try {
      await sendEmail(
        usuario.correo,
        "Nuevo código de verificación",
        `Tu nuevo código de verificación es: ${codigo}\n\nEste código caduca en 10 minutos.`,
      );
      flash(
        req,
        "success",
        `Nuevo código enviado al correo: ${usuario.correo}`,
      );
    } catch (emailError) {
      flash(
        req,
        "error",
        "Error al enviar el correo de verificación. Verifica la configuración.",
      );
    }

    res.redirect("/verificar-correo");
  } catch (error) {
    next(error);
  }
};

exports.loginForm = (req, res) => {
  if (req.query.expirada === "1" && !res.locals.flash) {
    res.locals.flash = {
      type: "info",
      message: "Tu sesión expiró después de 15 minutos de inactividad.",
    };
  }
  res.render("auth/index", {
    title: "Iniciar sesión",
    layout: false,
    activeForm: "login",
  });
};

exports.login = async (req, res, next) => {
  try {
    const correo = String(req.body.correo || "")
      .toLowerCase()
      .trim();
    const password = String(req.body.password || "");

    // Administrador
    const admin = await Administrador.findOne({ correo, activo: true });
    if (admin) {
      const validAdmin = await bcrypt.compare(password, admin.password_hash);
      if (validAdmin) {
        admin.ultimo_acceso = new Date();
        await admin.save();
        req.session.adminId = String(admin._id);
        req.session.rol = "administrador";
        req.session.nombre = admin.nombre;
        req.session.correo = admin.correo;
        return res.redirect("/admin/recursos");
      }
    }

    // Usuario
    const usuario = await Usuario.findOne({ correo });
    if (usuario) {
      const passwordMatch = usuario.password_hash
        ? await bcrypt.compare(password, usuario.password_hash)
        : false;
      if (passwordMatch) {
        if (!usuario.emailVerified || usuario.estado === "No Verificado") {
          req.session.tempUserId = usuario._id;
          flash(req, "info", "Debes verificar tu cuenta para continuar.");
          return res.redirect("/verificar-correo");
        }
        if (usuario.estado !== "Activo") {
          flash(req, "error", `Su cuenta está en estado: ${usuario.estado}.`);
          return res.redirect("/login");
        }

        req.session.userId = String(usuario._id);
        req.session.rol = "usuario";
        req.session.nombre = usuario.nombre;
        req.session.correo = usuario.correo;
        return res.redirect("/catalogo");
      }
    }

    // Error genérico
    flash(req, "error", "Correo o contraseña incorrectos.");
    return res.redirect("/login");
  } catch (error) {
    next(error);
  }
};

exports.logout = (req, res) =>
  req.session.destroy(() => res.redirect("/login"));

exports.forgotPasswordForm = (req, res) => {
  res.render("auth/index", {
    title: "Recuperar contraseña",
    layout: false,
    activeForm: "forgot",
  });
};

exports.forgotPassword = async (req, res, next) => {
  try {
    const correo = String(req.body.correo || "")
      .toLowerCase()
      .trim();

    let user = await Administrador.findOne({ correo, activo: true });
    if (!user) user = await Usuario.findOne({ correo });

    if (!user) {
      flash(
        req,
        "success",
        "Si el correo está registrado, recibirás un código de recuperación.",
      );
      return res.redirect("/recuperar-password/verificar");
    }

    const codigo = generateCode();
    user.resetCodeHash = await bcrypt.hash(codigo, 10);
    user.resetCodeExpires = Date.now() + 600000; // 10 mins
    user.resetAttempts = 0;
    await user.save();

    try {
      await sendEmail(
        correo,
        "Recuperación de contraseña - BiblioNet",
        `Tu código de recuperación es: ${codigo}\n\nEste código caduca en 10 minutos.`,
      );
      req.session.resetEmail = correo;
      flash(
        req,
        "success",
        `Se ha enviado un código de recuperación al correo: ${correo}`,
      );
      return res.redirect("/recuperar-password/verificar");
    } catch (emailError) {
      flash(
        req,
        "error",
        "Error de configuración SMTP. No se pudo enviar el correo de recuperación.",
      );
      return res.redirect("/recuperar-password");
    }
  } catch (error) {
    next(error);
  }
};

exports.verifyResetCodeForm = (req, res) => {
  if (!req.session.resetEmail) return res.redirect("/recuperar-password");
  res.render("auth/index", {
    title: "Verificar código",
    layout: false,
    activeForm: "verifyResetCode",
  });
};

exports.verifyResetCode = async (req, res, next) => {
  try {
    const codigo = String(req.body.codigo || "").trim();
    const correo = req.session.resetEmail;
    if (!correo) return res.redirect("/recuperar-password");

    let user = await Administrador.findOne({ correo, activo: true });
    if (!user) user = await Usuario.findOne({ correo });

    if (!user || !user.resetCodeHash || Date.now() > user.resetCodeExpires) {
      flash(req, "error", "El código es inválido o ha expirado.");
      return res.redirect("/recuperar-password/verificar");
    }

    if (user.resetAttempts >= 3) {
      flash(
        req,
        "error",
        "Demasiados intentos fallidos. Solicita un nuevo código.",
      );
      return res.redirect("/recuperar-password");
    }

    const isMatch = await bcrypt.compare(codigo, user.resetCodeHash);
    if (!isMatch) {
      user.resetAttempts += 1;
      await user.save();
      flash(
        req,
        "error",
        `Código incorrecto. Intentos restantes: ${3 - user.resetAttempts}`,
      );
      return res.redirect("/recuperar-password/verificar");
    }

    req.session.resetCodeValidated = true;
    res.redirect("/recuperar-password/nueva");
  } catch (error) {
    next(error);
  }
};

exports.resetPasswordForm = (req, res) => {
  if (!req.session.resetEmail || !req.session.resetCodeValidated)
    return res.redirect("/recuperar-password");
  res.render("auth/index", {
    title: "Nueva contraseña",
    layout: false,
    activeForm: "resetPassword",
  });
};

exports.resetPassword = async (req, res, next) => {
  try {
    if (!req.session.resetEmail || !req.session.resetCodeValidated)
      return res.redirect("/recuperar-password");

    const { password, confirmPassword } = req.body;
    const correo = req.session.resetEmail;

    if (password !== confirmPassword) {
      flash(req, "error", "Las contraseñas no coinciden.");
      return res.redirect("/recuperar-password/nueva");
    }

    if (!PASSWORD_REGEX.test(password)) {
      flash(
        req,
        "error",
        "La contraseña debe tener entre 8 y 20 caracteres, una mayúscula, una minúscula, un número y un carácter especial.",
      );
      return res.redirect("/recuperar-password/nueva");
    }

    let user = await Administrador.findOne({ correo, activo: true });
    if (!user) user = await Usuario.findOne({ correo });

    if (user) {
      user.password_hash = await bcrypt.hash(password, 12);
      user.resetCodeHash = undefined;
      user.resetCodeExpires = undefined;
      user.resetAttempts = 0;

      // Implicit email verification: If they reset their password via email, the email is valid.
      if (user.emailVerified !== undefined) {
        user.emailVerified = true;
        if (user.estado === "No Verificado") {
          user.estado = "Activo";
        }
      }

      await user.save();
    }

    delete req.session.resetEmail;
    delete req.session.resetCodeValidated;

    flash(req, "success", "Tu contraseña ha sido actualizada exitosamente.");
    res.redirect("/login");
  } catch (error) {
    next(error);
  }
};

exports.googleCallback = (req, res) => {
  const user = req.user;
  if (!user) {
    flash(req, "error", "Error al autenticar con Google.");
    return res.redirect("/login");
  }

  if (user.authRol === "administrador") {
    req.session.adminId = String(user._id);
    req.session.rol = "administrador";
    req.session.nombre = user.nombre;
    req.session.correo = user.correo;
    return res.redirect("/admin/recursos");
  } else {
    req.session.userId = String(user._id);
    req.session.rol = "usuario";
    req.session.nombre = user.nombre;
    req.session.correo = user.correo;
    return res.redirect("/catalogo");
  }
};
