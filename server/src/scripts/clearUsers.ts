import sqlite3 from 'sqlite3';
import path from 'path';

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../data/database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log(`Connecting to database at ${dbPath}...`);

db.serialize(() => {
  console.log('Clearing user-related data...');

  // Delete all users and related data (reviews, passkeys, interactions)
  db.run('DELETE FROM reviews', (err) => {
    if (err) console.error('Error clearing reviews:', err);
    else console.log('✅ Reviews cleared.');
  });

  db.run('DELETE FROM webauthn_credentials', (err) => {
    if (err) console.error('Error clearing webauthn_credentials:', err);
    else console.log('✅ Passkeys (webauthn_credentials) cleared.');
  });

  db.run('DELETE FROM user_interactions', (err) => {
    if (err) console.error('Error clearing user_interactions:', err);
    else console.log('✅ User interactions cleared.');
  });

  db.run('DELETE FROM users', (err) => {
    if (err) console.error('Error clearing users:', err);
    else console.log('✅ Users cleared.');
  });

});

db.close((err) => {
  if (err) {
    console.error('Error closing database:', err);
  } else {
    console.log('🎉 All user data has been successfully deleted.');
  }
});
