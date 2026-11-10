// Lets route handlers be async without try/catch in every one.
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
