const fs = require('fs');
const path = require('path');
const https = require('https');
const readline = require('readline');

const PROJECT_REF = 'zvmdaldcrkpxztbwnakw';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data ? JSON.parse(data) : null);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (err) => reject(err));

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runUpload(token) {
  if (!token.trim()) {
    console.error("❌ Error: Supabase token cannot be empty.");
    process.exit(1);
  }

  try {
    console.log("\n📡 Connecting to Supabase Management API...");
    
    const getOptions = {
      hostname: 'api.supabase.com',
      path: `/v1/projects/${PROJECT_REF}/config/auth`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    };

    const currentConfig = await request(getOptions);
    console.log("✅ Successfully retrieved current auth config keys.");

    // Read local HTML files
    const baseDir = path.resolve(__dirname, '../../');
    
    const files = {
      confirmation: 'email_confirmation_template.html',
      recovery: 'email_recovery_template.html',
      magic_link: 'email_magic_link_template.html',
      email_change: 'email_change_email_template.html'
    };

    const patchBody = {};
    
    // Map configuration keys dynamically by searching get response fields
    const configKeys = Object.keys(currentConfig);
    
    for (const [type, fileName] of Object.entries(files)) {
      const filePath = path.join(baseDir, fileName);
      if (!fs.existsSync(filePath)) {
        console.warn(`⚠️ Warning: Template file not found at ${filePath}`);
        continue;
      }

      const htmlContent = fs.readFileSync(filePath, 'utf8');
      
      // Find matching key in GET response
      // e.g. mailer_templates_confirmation, mailer_templates_confirmation_content
      let matchedKey = configKeys.find(k => k === `mailer_templates_${type}` || k === `mailer_templates_${type}_content`);
      
      if (!matchedKey) {
        // Fallback if not found in GET response, try standard naming
        matchedKey = `mailer_templates_${type}`;
      }
      
      patchBody[matchedKey] = htmlContent;
      console.log(`📝 Prepared template upload: ${fileName} ➔ ${matchedKey}`);
    }

    if (Object.keys(patchBody).length === 0) {
      console.error("❌ Error: No templates were prepared for upload.");
      process.exit(1);
    }

    console.log("\n📤 Uploading templates to your Supabase project...");

    const patchOptions = {
      hostname: 'api.supabase.com',
      path: `/v1/projects/${PROJECT_REF}/config/auth`,
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };

    await request(patchOptions, patchBody);
    console.log("\n🎉 SUCCESS: All Nirikshaka email templates have been updated on your Supabase project!");

  } catch (err) {
    console.error(`\n❌ Upload failed: ${err.message}`);
  }
}

async function main() {
  console.log("\n🚀 Nirikshaka Supabase Email Template Auto-Uploader\n");
  
  const token = process.env.SUPABASE_PAT || process.argv[2];
  if (token) {
    rl.close();
    await runUpload(token);
  } else {
    rl.question('Please enter your Supabase Personal Access Token (PAT): ', async (inputToken) => {
      rl.close();
      await runUpload(inputToken);
    });
  }
}

main();
