const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./auth.db', (err) => {
  if (err) console.error(err.message);
  else {
    console.log('SQLite connected');
    db.run("PRAGMA foreign_keys = ON");
  }
});
module.exports = db