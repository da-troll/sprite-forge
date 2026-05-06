module.exports = {
  apps: [{
    name: '2026-05-06-sprite-forge',
    script: 'server/index.js',
    cwd: '/home/eve/projects/nightly-mvps/2026-05-06-sprite-forge',
    interpreter: 'node',
    env: { NODE_ENV: 'production' },
    max_memory_restart: '1G',
    restart_delay: 3000,
    autorestart: true,
  }],
};
