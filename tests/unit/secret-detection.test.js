const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('Secret Detection', () => {
  const scriptPath = path.join(__dirname, '../../scripts/check-secrets.sh');
  let tmpFilePath;

  beforeEach(() => {
    // Create a temp file for each test
    const tmpDir = os.tmpdir();
    tmpFilePath = path.join(tmpDir, `env-example-${Date.now()}`);
  });

  afterEach(() => {
    // Cleanup
    if (fs.existsSync(tmpFilePath)) {
      fs.unlinkSync(tmpFilePath);
    }
  });

  test('check-secrets.sh should pass with safe placeholder', () => {
    // Write safe content
    fs.writeFileSync(tmpFilePath, 'GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE_DO_NOT_COMMIT_REAL_KEY\n');

    const output = execSync(`${scriptPath} ${tmpFilePath}`, {
        encoding: 'utf8',
        stdio: 'pipe'
    });
    expect(output).toContain('✅ Secret check passed');
  });

  test('check-secrets.sh should fail with real API key pattern', () => {
    // Write dangerous content (fake real key)
    const fakeKey = 'GEMINI_API_KEY=AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
    fs.writeFileSync(tmpFilePath, fakeKey);

    expect(() => {
      execSync(`${scriptPath} ${tmpFilePath}`, { stdio: 'pipe' });
    }).toThrow();
  });

  test('check-secrets.sh should warn if file is missing', () => {
     // Ensure file does not exist
     if (fs.existsSync(tmpFilePath)) {
        fs.unlinkSync(tmpFilePath);
     }

     const output = execSync(`${scriptPath} ${tmpFilePath}`, {
        encoding: 'utf8',
        stdio: 'pipe'
    });
    expect(output).toContain('Warning: Target file not found');
  });
});
