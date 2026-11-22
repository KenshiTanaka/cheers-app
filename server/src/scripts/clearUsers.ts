import sqlite3 from 'sqlite3';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const dbPath = process.env.DATABASE_PATH || path.resolve(__dirname, '../../data/database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log(`Connecting to database at ${dbPath}...`);

function runSql(sql: string): Promise<number> {
  return new Promise((resolve, reject) => {
    db.run(sql, function (err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
}

async function clearUsers() {
  try {
    await runSql('PRAGMA foreign_keys = ON');
    await runSql('BEGIN TRANSACTION');

    console.log('Clearing user-related data...');

    const deletedReviews = await runSql('DELETE FROM reviews');
    console.log(`✅ Reviews cleared (${deletedReviews} rows).`);

    const deletedAuthenticators = await runSql('DELETE FROM authenticators');
    console.log(`✅ Passkeys (authenticators) cleared (${deletedAuthenticators} rows).`);

    // shops.created_by の参照をクリアしてからユーザーを削除
    await runSql('UPDATE shops SET created_by = NULL WHERE created_by IS NOT NULL');

    const deletedUsers = await runSql('DELETE FROM users');
    console.log(`✅ Users cleared (${deletedUsers} rows).`);

    await runSql('COMMIT');
    console.log('🎉 All user data has been successfully deleted.');
  } catch (err) {
    console.error('❌ Error clearing user data. Rolling back...', err);
    try {
      await runSql('ROLLBACK');
    } catch {
      // ignore rollback error
    }
    process.exitCode = 1;
  } finally {
    db.close((err) => {
      if (err) console.error('Error closing database:', err);
    });
  }
}

clearUsers();
