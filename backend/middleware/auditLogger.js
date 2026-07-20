const db = require('../db');

function auditLogger(req, res, next) {
  // Skip static files & favicon
  if (req.path.includes('.')) {
    return next();
  }

  const oldWrite = res.write;
  const oldEnd = res.end;

  const chunks = [];

  res.write = function (chunk) {
    if (chunk) chunks.push(Buffer.from(chunk));
    return oldWrite.apply(res, arguments);
  };

  res.end = function (chunk) {
    if (chunk) chunks.push(Buffer.from(chunk));
    const responseBody = Buffer.concat(chunks).toString('utf8');

    try {
      let bodyStr = '';
      if (req.body && Object.keys(req.body).length > 0) {
        bodyStr = JSON.stringify(req.body);
      }

      const queryStr = JSON.stringify(req.query || {});
      const truncatedBody = bodyStr.length > 2000 ? bodyStr.substring(0, 2000) + '...' : bodyStr;
      const truncatedResp = responseBody.length > 2000 ? responseBody.substring(0, 2000) + '...' : responseBody;

      db.run(
        `INSERT INTO HIST_LOG (API_URL, METHOD, PARAM_BODY, PARAM_QUERY, RESPONSE)
         VALUES (?, ?, ?, ?, ?)`,
        [req.path, req.method, truncatedBody, queryStr, truncatedResp]
      ).catch(err => console.error('Audit Log Error:', err));
    } catch (err) {
      console.error('Audit Log Error:', err);
    }

    return oldEnd.apply(res, arguments);
  };

  next();
}

module.exports = auditLogger;
