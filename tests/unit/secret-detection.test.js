const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

describe('Secret Detection', () => {
  const envExamplePath = path.join(__dirname, '../../.env.example');

  test('check-secrets.sh should pass with current .env.example', () => {
    expect(() => {
      execSync('./scripts/check-secrets.sh', { stdio: 'pipe' });
    }).not.toThrow();
  });

  test('.env.example should not contain real API key patterns', () => {
    const content = fs.readFileSync(envExamplePath, 'utf8');
    // Check for the specific Gemini API key pattern used in the script
    expect(content).not.toMatch(/GEMINI_API_KEY=(AIza[a-zA-Z0-9_-]{35}|AI[a-zA-Z0-9_-]{30,})/);
  });

  test('.env.example should contain warning in placeholder', () => {
    const content = fs.readFileSync(envExamplePath, 'utf8');
    expect(content).toMatch(/DO_NOT_COMMIT_REAL_KEY/);
  });
});
