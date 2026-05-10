const ldap = require('ldapjs');
const bcrypt = require('bcryptjs');
const ldapConfig = require('../config/ldap');
const LdapUsuarioMock = require('../models/LdapUsuarioMock');

async function buscarUsuarioMock(correo, password) {
  const usuario = await LdapUsuarioMock.findOne({
    correo: correo.toLowerCase(),
    estado_sena: 'Activo'
  });
  if (!usuario) return null;

  const ok = usuario.password_hash ? await bcrypt.compare(password, usuario.password_hash) : true;
  if (!ok) return null;

  return {
    uid: usuario.uid,
    nombre: usuario.nombre,
    documento: usuario.documento,
    tipo_documento: usuario.tipo_documento,
    correo: usuario.correo,
    programa_formacion: usuario.programa_formacion,
    ficha: usuario.ficha,
    tipo_usuario: usuario.tipo_usuario,
    estado_sena: usuario.estado_sena
  };
}

function buscarUsuarioReal(correo, password) {
  return new Promise((resolve, reject) => {
    const client = ldap.createClient({ url: ldapConfig.url });
    const filter = `(mail=${correo})`;

    client.bind(ldapConfig.bindDN, ldapConfig.bindPassword, (bindError) => {
      if (bindError) return reject(bindError);

      client.search(ldapConfig.baseDN, { scope: 'sub', filter }, (searchError, res) => {
        if (searchError) return reject(searchError);
        let found = null;

        res.on('searchEntry', (entry) => {
          const item = entry.object;
          found = {
            dn: item.dn,
            uid: item.uid,
            nombre: item.cn,
            documento: item.employeeNumber || item.uid,
            tipo_documento: item.documentType || 'CC',
            correo: item.mail,
            programa_formacion: item.departmentNumber || item.description,
            ficha: item.senaFicha,
            tipo_usuario: item.employeeType || 'Aprendiz',
            estado_sena: item.accountStatus || 'Activo'
          };
        });

        res.on('error', reject);
        res.on('end', () => {
          if (!found) return resolve(null);
          client.bind(found.dn, password, (authError) => {
            client.unbind();
            resolve(authError ? null : found);
          });
        });
      });
    });
  });
}

exports.buscarUsuario = (correo, password) => {
  if (ldapConfig.mode === 'real') return buscarUsuarioReal(correo, password);
  return buscarUsuarioMock(correo, password);
};
