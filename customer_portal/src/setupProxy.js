const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  app.use(
    '/GitHub/Capstone--Development/customer',
    createProxyMiddleware({
      target: 'http://localhost:8000',
      changeOrigin: true,
      pathRewrite: {
        '^/GitHub/Capstone--Development/customer': '',
      },
      logLevel: 'warn',
    })
  );
};
