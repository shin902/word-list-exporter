const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

describe('Secret Detection', () => {
  const envExamplePath = path.join(__dirname, '../../.env.example');

  test('check-secrets.sh should pass with current .env.example', () => {
    const output = execSync('./scripts/check-secrets.sh', {
        encoding: 'utf8',
        stdio: 'pipe'
    });
    expect(output).toContain('✅ Secret check passed');
  });

  test('.env.example should not contain real API key patterns', () => {
    const content = fs.readFileSync(envExamplePath, 'utf8');
    // Check for the specific Gemini API key pattern used in the script
    expect(content).not.toMatch(/GEMINI_API_KEY=AIza[a-zA-Z0-9_-]{35}/);
  });

  test('.env.example should contain warning in placeholder', () => {
    const content = fs.readFileSync(envExamplePath, 'utf8');
    expect(content).toMatch(/DO_NOT_COMMIT_REAL_KEY/);
  });

  test('check-secrets.sh should fail with real API key pattern', () => {
    const backup = fs.readFileSync(envExamplePath, 'utf8');

    try {
      // Inject a fake "real" key
      const fakeKey = 'GEMINI_API_KEY=AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
      fs.writeFileSync(envExamplePath, fakeKey);

      expect(() => {
        execSync('./scripts/check-secrets.sh', { stdio: 'pipe' });
      }).toThrow();

    } catch (e) {
       // If the test itself fails (e.g. writeFileSync fails), ensure we still restore
       throw e;
    } finally {
      fs.writeFileSync(envExamplePath, backup);
    }
  });
});
