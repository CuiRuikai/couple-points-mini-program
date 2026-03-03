const success = (data) => ({ data, error: null });
const error = (msg, code = 500) => ({ data: null, error: msg, code });

module.exports = { success, error };
