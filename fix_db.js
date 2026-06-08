const init = require('sql.js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

(async () => {
  const SQL = await init();
  const dbPath = path.join(process.cwd(), 'data/ai-creation.db');
  const buf = fs.readFileSync(dbPath);
  const db = new SQL.Database(buf);

  // 1. List all models with resolution_options
  const all = db.exec('SELECT id, name, resolution_options, resolution_pricing FROM ai_models');
  for (const row of all[0].values) {
    if (row[2]) console.log('Model:', row[0], row[1], '| res_opts:', row[2], '| res_pricing:', row[3]);
  }

  // 2. Find and fix Seedance Fast - remove 1080P
  const sf = db.exec("SELECT id, name, resolution_options, resolution_pricing FROM ai_models WHERE name LIKE '%Seedance%Fast%' OR name LIKE '%seedance%fast%'");
  console.log('Seedance Fast rows:', sf.length > 0 ? sf[0].values.length : 0);

  if (sf.length > 0 && sf[0].values.length > 0) {
    const modelId = sf[0].values[0][0];
    console.log('Found model id:', modelId, 'name:', sf[0].values[0][1]);
    // Update to only 720P
    db.run('UPDATE ai_models SET resolution_options = ?, resolution_pricing = ? WHERE id = ?',
      [JSON.stringify(['720p']), JSON.stringify({ '720p': 0 }), modelId]);
    console.log('Updated Seedance Fast to 720p only');
  } else {
    console.log('Seedance Fast not found, trying broader search...');
    // Try to find by looking at all models
    const allModels = db.exec('SELECT id, name FROM ai_models');
    for (const row of allModels[0].values) {
      console.log('  id:', row[0], 'name:', row[1]);
    }
  }

  // 3. Reset password for 404548480@qq.com
  const userCheck = db.exec("SELECT id, email, nickname FROM users WHERE email = '404548480@qq.com'");
  console.log('User found:', userCheck.length > 0 ? userCheck[0].values.length : 0);

  if (userCheck.length > 0 && userCheck[0].values.length > 0) {
    const newHash = await bcrypt.hash('Cx13531293580', 10);
    db.run('UPDATE users SET password_hash = ? WHERE email = ?', [newHash, '404548480@qq.com']);
    const verify = db.exec('SELECT password_hash FROM users WHERE email = ?', ['404548480@qq.com']);
    const hash = verify[0].values[0][0];
    const match = await bcrypt.compare('Cx13531293580', hash);
    console.log('Password reset for 404548480@qq.com. Verify:', match);
  } else {
    console.log('User 404548480@qq.com NOT FOUND! Listing all users:');
    const users = db.exec('SELECT id, email, nickname FROM users');
    for (const row of users[0].values) {
      console.log('  id:', row[0], 'email:', row[1], 'nickname:', row[2]);
    }
  }

  // Save
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
  console.log('DB saved.');
  db.close();
})();
