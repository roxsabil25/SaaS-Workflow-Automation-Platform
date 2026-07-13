/**
 * Migration: Add version and revision_parent_id columns to documents table
 * Replicates the same revision chain structure from templates into documents.
 * 
 * Run: node migrate-documents-lifecycle.js
 */
require('dotenv').config();
const pool = require('./config/db');

async function migrate() {
  console.log('🚀 Starting documents lifecycle migration...\n');

  try {
    // 1. Check if 'version' column already exists
    const [versionCheck] = await pool.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'documents' AND COLUMN_NAME = 'version'`
    );

    if (versionCheck.length === 0) {
      console.log('➕ Adding "version" column to documents table...');
      await pool.execute(
        `ALTER TABLE documents ADD COLUMN version INT NOT NULL DEFAULT 1 AFTER current_revision`
      );
      console.log('✅ "version" column added successfully.\n');
    } else {
      console.log('⏭️  "version" column already exists, skipping.\n');
    }

    // 2. Check if 'revision_parent_id' column already exists
    const [parentCheck] = await pool.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'documents' AND COLUMN_NAME = 'revision_parent_id'`
    );

    if (parentCheck.length === 0) {
      console.log('➕ Adding "revision_parent_id" column to documents table...');
      await pool.execute(
        `ALTER TABLE documents ADD COLUMN revision_parent_id VARCHAR(255) DEFAULT NULL AFTER status`
      );
      console.log('✅ "revision_parent_id" column added successfully.\n');
    } else {
      console.log('⏭️  "revision_parent_id" column already exists, skipping.\n');
    }

    // 3. Add index on revision_parent_id (if not exists)
    const [indexCheck] = await pool.execute(
      `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'documents' AND INDEX_NAME = 'idx_revision_parent_id'`
    );

    if (indexCheck.length === 0) {
      console.log('➕ Adding index on "revision_parent_id"...');
      await pool.execute(
        `ALTER TABLE documents ADD INDEX idx_revision_parent_id (revision_parent_id)`
      );
      console.log('✅ Index added successfully.\n');
    } else {
      console.log('⏭️  Index already exists, skipping.\n');
    }

    // 4. Add foreign key constraint (if not exists)
    const [fkCheck] = await pool.execute(
      `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'documents' 
       AND COLUMN_NAME = 'revision_parent_id' AND REFERENCED_TABLE_NAME = 'documents'`
    );

    if (fkCheck.length === 0) {
      console.log('➕ Adding foreign key constraint on "revision_parent_id"...');
      await pool.execute(
        `ALTER TABLE documents ADD CONSTRAINT fk_documents_revision_parent 
         FOREIGN KEY (revision_parent_id) REFERENCES documents(document_id) ON DELETE CASCADE`
      );
      console.log('✅ Foreign key constraint added successfully.\n');
    } else {
      console.log('⏭️  Foreign key constraint already exists, skipping.\n');
    }

    console.log('🎉 Migration completed successfully!');
    console.log('   - documents.version: INT NOT NULL DEFAULT 1');
    console.log('   - documents.revision_parent_id: VARCHAR(255) DEFAULT NULL → documents(document_id) ON DELETE CASCADE');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

migrate();
