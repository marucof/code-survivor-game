const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const startButton = document.getElementById('start-button');
const titleScreen = document.getElementById('title-screen');
const gameUi = document.getElementById('game-ui');
const levelUpModal = document.getElementById('level-up-modal');
const upgradeOptionsContainer = document.getElementById('upgrade-options');
const levelEl = document.getElementById('level');
const timerEl = document.getElementById('timer');
const killsEl = document.getElementById('kills');
const xpBar = document.getElementById('xp-bar');

let gameRunning = false;
let gamePaused = false; // To pause game during level up

// Game State
let player;
let enemies = [];
let projectiles = [];
let xpOrbs = [];
let level = 1;
let xp = 0;
let xpToNextLevel = 10;
let kills = 0;
let gameTimer = 0;
let enemySpawnTimer = 0;
let projectileTimer = 0;

// Player Stats & Config
let playerStats = {
    speed: 3,
    dashDistance: 120,
    dashCooldown: 120, // 2 seconds in frames
    lastDashFrame: -120,
    projectileSpeed: 5,
    projectileCount: 1,
    projectileDamage: 1,
    fireRate: 30, // frames per shot
    luck: 1, // Affects drop rates and upgrade options
};

// Set canvas size
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);

let isDragging = false;
let dragStartX, dragStartY;

// Game loop
function gameLoop() {
    if (!gameRunning || gamePaused) return;

    gameTimer++;

    // Clear canvas
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Update & Draw Player
    player.draw();

    // Update & Draw Enemies
    enemySpawnTimer++;
    const spawnInterval = Math.max(10, 60 - Math.floor(gameTimer / 600)); // Faster spawns over time
    if (enemySpawnTimer % spawnInterval === 0) { 
        let enemyType;
        const timeInSeconds = gameTimer / 60;
        if (timeInSeconds < 30) {
            enemyType = 'bitmite';
        } else if (timeInSeconds < 90) {
            enemyType = Math.random() < 0.7 ? 'bitmite' : 'spamBot';
        } else {
            enemyType = Math.random() < 0.5 ? 'bitmite' : (Math.random() < 0.7 ? 'spamBot' : 'bruteForcer');
        }

        const type = enemyTypes[enemyType];
        const x = Math.random() < 0.5 ? -type.size : canvas.width + type.size;
        const y = Math.random() * canvas.height;

        enemies.push({
            x: x,
            y: y,
            size: type.size,
            speed: type.speed,
            hp: type.hp,
            maxHp: type.hp,
            color: type.color,
            xpValue: type.xp,
            draw() {
                // Draw HP bar
                const hpPercentage = this.hp / this.maxHp;
                ctx.fillStyle = '#555';
                ctx.fillRect(this.x - this.size / 2, this.y - this.size - 8, this.size, 5);
                ctx.fillStyle = 'red';
                ctx.fillRect(this.x - this.size / 2, this.y - this.size - 8, this.size * hpPercentage, 5);

                // Draw enemy
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fill();
            },
            update() {
                const angle = Math.atan2(player.y - this.y, player.x - this.x);
                this.x += Math.cos(angle) * this.speed;
                this.y += Math.sin(angle) * this.speed;
            }
        });
    }

    enemies.forEach(enemy => {
        enemy.update();
        enemy.draw();

        const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
        if (dist - enemy.size - player.size < 1) {
            gameRunning = false;
            alert('Game Over');
            document.location.reload();
        }
    });

    // Update & Draw Projectiles
    projectileTimer++;
    if (projectileTimer % playerStats.fireRate === 0) { 
        const closestEnemy = enemies.reduce((closest, enemy) => {
            if (!closest) return enemy;
            const distToEnemy = Math.hypot(player.x - enemy.x, player.y - enemy.y);
            const distToClosest = Math.hypot(player.x - closest.x, player.y - closest.y);
            return distToEnemy < distToClosest ? enemy : closest;
        }, null);

        if (closestEnemy) {
            for (let i = 0; i < playerStats.projectileCount; i++) {
                const angle = Math.atan2(closestEnemy.y - player.y, closestEnemy.x - player.x);
                projectiles.push({
                    x: player.x,
                    y: player.y,
                    size: 5,
                    color: '#ff0',
                    speed: playerStats.projectileSpeed,
                    angle: angle,
                    draw() {
                        ctx.fillStyle = this.color;
                        ctx.beginPath();
                        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                        ctx.fill();
                    },
                    update() {
                        this.x += Math.cos(this.angle) * this.speed;
                        this.y += Math.sin(this.angle) * this.speed;
                    }
                });
            }
        }
    }

    projectiles.forEach((projectile, pIndex) => {
        projectile.update();
        projectile.draw();

        enemies.forEach((enemy, eIndex) => {
            const dist = Math.hypot(projectile.x - enemy.x, projectile.y - enemy.y);
            if (dist - enemy.size - projectile.size < 1) {
                enemy.hp -= playerStats.projectileDamage;
                if (enemy.hp <= 0) {
                    // Create XP Orb
                    xpOrbs.push({
                        x: enemy.x,
                        y: enemy.y,
                        size: 5,
                        value: enemy.xpValue, // XP value
                        color: '#0ff',
                        draw() {
                            ctx.fillStyle = this.color;
                            ctx.beginPath();
                            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                            ctx.fill();
                        }
                    });
                    enemies.splice(eIndex, 1);
                    kills++;
                }
                projectiles.splice(pIndex, 1);
            }
        });

        // Remove projectiles that are off-screen
        if (projectile.x < 0 || projectile.x > canvas.width || projectile.y < 0 || projectile.y > canvas.height) {
            projectiles.splice(pIndex, 1);
        }
    });

    // Handle XP Orbs
    xpOrbs.forEach((orb, index) => {
        orb.draw();
        const distToPlayer = Math.hypot(player.x - orb.x, player.y - orb.y);
        if (distToPlayer < 75) { // Magnet range
            const angle = Math.atan2(player.y - orb.y, player.x - orb.x);
            orb.x += Math.cos(angle) * 4;
            orb.y += Math.sin(angle) * 4;
        }

        if (distToPlayer < player.size) { // Collect orb
            gainXp(orb.value);
            xpOrbs.splice(index, 1);
        }
    });

    updateUi();

    requestAnimationFrame(gameLoop);
}

// Start the game
startButton.addEventListener('click', () => {
    titleScreen.style.display = 'none';
    gameUi.style.display = 'block';
    canvas.style.display = 'block';
    initGame();
    gameRunning = true;
    resizeCanvas();
    gameLoop();
});

function initGame() {
    player = {
        x: canvas.width / 2,
        y: canvas.height / 2,
        size: 20,
        color: '#0f0',
        draw() {
            ctx.beginPath();
            ctx.moveTo(this.x, this.y - this.size);
            ctx.lineTo(this.x - this.size / 1.5, this.y + this.size / 2);
            ctx.lineTo(this.x + this.size / 1.5, this.y + this.size / 2);
            ctx.closePath();
            ctx.fillStyle = this.color;
            ctx.fill();
        }
    };
    // Reset game state
    enemies = [];
    projectiles = [];
    xpOrbs = [];
    level = 1;
    xp = 0;
    xpToNextLevel = 10;
    kills = 0;
    gameTimer = 0;
    enemySpawnTimer = 0;
    projectileTimer = 0;

    playerStats = {
        speed: 3,
        dashDistance: 120,
        dashCooldown: 120, 
        lastDashFrame: -120,
        projectileSpeed: 5,
        projectileCount: 1,
        projectileDamage: 1,
        fireRate: 30, 
        luck: 1,
    };
    updateUi();
}

// Mouse/Touch controls
canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    // Ensure player object is initialized before accessing its properties
    if (player) {
        player.x = e.clientX;
        player.y = e.clientY;
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (isDragging && player) {
        player.x = e.clientX;
        player.y = e.clientY;
    }
});

canvas.addEventListener('mouseup', (e) => {
    if (isDragging && player) {
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) { // Tap
            if (gameTimer - playerStats.lastDashFrame > playerStats.dashCooldown) {
                const angle = Math.atan2(e.clientY - player.y, e.clientX - player.x);
                player.x += Math.cos(angle) * playerStats.dashDistance;
                player.y += Math.sin(angle) * playerStats.dashDistance;
                playerStats.lastDashFrame = gameTimer;
            }
        }
    }
    isDragging = false;
});

canvas.addEventListener('touchstart', (e) => {
    isDragging = true;
    dragStartX = e.touches[0].clientX;
    dragStartY = e.touches[0].clientY;
    if (player) {
        player.x = e.touches[0].clientX;
        player.y = e.touches[0].clientY;
    }
});

canvas.addEventListener('touchmove', (e) => {
    if (isDragging && player) {
        e.preventDefault();
        player.x = e.touches[0].clientX;
        player.y = e.touches[0].clientY;
    }
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
    if (isDragging && player) {
        const dx = e.changedTouches[0].clientX - dragStartX;
        const dy = e.changedTouches[0].clientY - dragStartY;
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) { // Tap
            if (gameTimer - playerStats.lastDashFrame > playerStats.dashCooldown) {
                const angle = Math.atan2(e.changedTouches[0].clientY - player.y, e.changedTouches[0].clientX - player.x);
                player.x += Math.cos(angle) * playerStats.dashDistance;
                player.y += Math.sin(angle) * playerStats.dashDistance;
                playerStats.lastDashFrame = gameTimer;
            }
        }
    }
    isDragging = false;
});

function gainXp(amount) {
    xp += amount;
    if (xp >= xpToNextLevel) {
        levelUp();
    }
    updateUi();
}

function levelUp() {
    gamePaused = true;
    level++;
    xp -= xpToNextLevel;
    xpToNextLevel = Math.floor(xpToNextLevel * 1.5);
    presentUpgradeOptions();
    updateUi();
    levelUpModal.style.display = 'block';
}

function updateUi() {
    levelEl.textContent = level;
    timerEl.textContent = (gameTimer / 60).toFixed(1);
    killsEl.textContent = kills;
    xpBar.style.width = `${(xp / xpToNextLevel) * 100}%`;
}

const allUpgrades = [
    { id: 'proj_count', text: 'Projectile +1', apply: () => playerStats.projectileCount++ },
    { id: 'fire_rate', text: 'Fire Rate +15%', apply: () => playerStats.fireRate *= 0.85 },
    { id: 'proj_speed', text: 'Projectile Speed +20%', apply: () => playerStats.projectileSpeed *= 1.2 },
    { id: 'player_speed', text: 'Movement Speed +10%', apply: () => playerStats.speed *= 1.1 },
    { id: 'dash_cd', text: 'Dash Cooldown -20%', apply: () => playerStats.dashCooldown *= 0.8 },
];

function presentUpgradeOptions() {
    upgradeOptionsContainer.innerHTML = '';
    const options = [...allUpgrades].sort(() => 0.5 - Math.random()).slice(0, 3);

    options.forEach(upgrade => {
        const button = document.createElement('button');
        button.textContent = upgrade.text;
        button.onclick = () => {
            applyUpgrade(upgrade.id);
            levelUpModal.style.display = 'none';
            gamePaused = false;
            requestAnimationFrame(gameLoop);
        };
        upgradeOptionsContainer.appendChild(button);
    });
}

function applyUpgrade(upgradeId) {
    const upgrade = allUpgrades.find(u => u.id === upgradeId);
    if (upgrade) {
        upgrade.apply();
    }
}

const enemyTypes = {
    bitmite: { size: 15, speed: 1.5, hp: 1, color: '#f00', xp: 1 },
    spamBot: { size: 20, speed: 1, hp: 3, color: '#f80', xp: 2 },
    bruteForcer: { size: 25, speed: 0.8, hp: 8, color: '#c0c', xp: 5 },
};