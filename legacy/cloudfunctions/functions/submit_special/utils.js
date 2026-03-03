const cloudbaseSDK = require("@cloudbase/node-sdk");

const cloudbase = cloudbaseSDK.init({
  env: cloudbaseSDK.SYMBOL_CURRENT_ENV
});

const success = (data) => ({ data, error: null });
const error = (msg, code = 500) => ({ data: null, error: msg, code });

module.exports = { cloudbase, success, error };
