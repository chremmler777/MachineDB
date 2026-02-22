import pool from './connection.js';
import bcrypt from 'bcrypt';

async function seedUsers() {
  const client = await pool.connect();
  try {
    // Clear existing users
    await client.query('TRUNCATE users CASCADE');

    // Create master user
    const masterPasswordHash = await bcrypt.hash('master123', 10);
    await client.query(
      'INSERT INTO users (username, password_hash, role, plant) VALUES ($1, $2, $3, $4)',
      ['master', masterPasswordHash, 'master', 'USA']
    );

    // Create viewer users
    const viewerPasswordHash = await bcrypt.hash('viewer123', 10);
    await client.query(
      'INSERT INTO users (username, password_hash, role, plant) VALUES ($1, $2, $3, $4)',
      ['viewer_usa', viewerPasswordHash, 'viewer', 'USA']
    );
    await client.query(
      'INSERT INTO users (username, password_hash, role, plant) VALUES ($1, $2, $3, $4)',
      ['viewer_mexico', viewerPasswordHash, 'viewer', 'Mexico']
    );

    console.log('✓ Users seeded successfully');
    console.log('  Master user: master / master123');
    console.log('  Viewer USA: viewer_usa / viewer123');
    console.log('  Viewer Mexico: viewer_mexico / viewer123');
  } catch (error) {
    console.error('Seed error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedUsers().catch(console.error);
