const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('Secret Detection', () => {
  const scriptPath = path.resolve(__dirname, '../../scripts/check-secrets.sh');
  let tmpFilePath;
  let tmpDir;

  beforeEach(() => {
    // Create a temp directory for each test
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'secret-check-'));
    tmpFilePath = path.join(tmpDir, '.env.example');
  });

  afterEach(() => {
    // Cleanup
    if (fs.existsSync(tmpFilePath)) {
      fs.unlinkSync(tmpFilePath);
    }
    // Remove other files and dir
    if (fs.existsSync(path.join(tmpDir, '.env'))) fs.unlinkSync(path.join(tmpDir, '.env'));
    if (fs.existsSync(path.join(tmpDir, '.git'))) fs.rmSync(path.join(tmpDir, '.git'), { recursive: true, force: true });

    if (fs.existsSync(tmpDir)) {
      fs.rmdirSync(tmpDir);
    }
  });

  test('check-secrets.sh should pass with safe placeholder', () => {
    // Write safe content
    fs.writeFileSync(tmpFilePath, 'GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE_DO_NOT_COMMIT_REAL_KEY\n');

    // We need to run inside a git repo for the script to find GIT_ROOT
    // Initialize a dummy git repo in the temp dir
    execSync('git init', { cwd: tmpDir, stdio: 'ignore' });

    const output = execSync(`${scriptPath} ${tmpFilePath}`, {
        cwd: tmpDir,
        encoding: 'utf8',
        stdio: 'pipe'
    });
    expect(output).toContain('✅ Secret check passed');
  });

  test('check-secrets.sh should fail with real API key pattern', () => {
    const fakeKey = 'GEMINI_API_KEY=AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
    fs.writeFileSync(tmpFilePath, fakeKey);
    execSync('git init', { cwd: tmpDir, stdio: 'ignore' });

    expect(() => {
      execSync(`${scriptPath} ${tmpFilePath}`, { cwd: tmpDir, stdio: 'pipe' });
    }).toThrow();
  });

  test('check-secrets.sh should fail with real API key pattern (quoted)', () => {
    const fakeKey = 'GEMINI_API_KEY="AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"';
    fs.writeFileSync(tmpFilePath, fakeKey);
    execSync('git init', { cwd: tmpDir, stdio: 'ignore' });

    expect(() => {
      execSync(`${scriptPath} ${tmpFilePath}`, { cwd: tmpDir, stdio: 'pipe' });
    }).toThrow();
  });

  test('check-secrets.sh should fail with real API key pattern (with spaces)', () => {
    const fakeKey = 'GEMINI_API_KEY = AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
    fs.writeFileSync(tmpFilePath, fakeKey);
    execSync('git init', { cwd: tmpDir, stdio: 'ignore' });

    expect(() => {
      execSync(`${scriptPath} ${tmpFilePath}`, { cwd: tmpDir, stdio: 'pipe' });
    }).toThrow();
  });

  test('check-secrets.sh should warn if file is missing', () => {
     if (fs.existsSync(tmpFilePath)) {
        fs.unlinkSync(tmpFilePath);
     }
     execSync('git init', { cwd: tmpDir, stdio: 'ignore' });

     const output = execSync(`${scriptPath} ${tmpFilePath}`, {
        cwd: tmpDir,
        encoding: 'utf8',
        stdio: 'pipe'
    });
    expect(output).toContain('Warning: Target file not found');
  });

  test('check-secrets.sh should fail if .env is staged', () => {
    // Initialize git repo
    execSync('git init', { cwd: tmpDir, stdio: 'ignore' });
    execSync('git config user.email "test@example.com"', { cwd: tmpDir, stdio: 'ignore' });
    execSync('git config user.name "Test User"', { cwd: tmpDir, stdio: 'ignore' });

    // Create .env file
    const envPath = path.join(tmpDir, '.env');
    fs.writeFileSync(envPath, 'SECRET=123');

    // Stage .env
    execSync('git add .env', { cwd: tmpDir, stdio: 'ignore' });

    // Also create valid .env.example so that part passes
    fs.writeFileSync(tmpFilePath, 'GEMINI_API_KEY=PLACEHOLDER\n');

    try {
        execSync(`${scriptPath} ${tmpFilePath}`, { cwd: tmpDir, stdio: 'pipe' });
        // Should throw
        throw new Error('Script should have failed due to staged .env');
    } catch (e) {
        // execSync throws on non-zero exit code
        // We verify the output contains the specific error message
        const output = e.stdout ? e.stdout.toString() : '';
        const errorOutput = e.stderr ? e.stderr.toString() : '';
        // Note: The script writes to stdout/stderr. execSync merges them if we don't handle stdio carefully,
        // but 'pipe' allows us to inspect them in the error object (e.stdout/e.stderr).
        // Our script echoes Error to stdout (fd 1).
        expect(output + errorOutput).toContain('Attempting to commit .env file');
    }
  });
});
