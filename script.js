// 添加捕获全局错误的处理程序
window.addEventListener('error', function(event) {
    console.error('全局错误:', event.message, 'at', event.filename, ':', event.lineno);
    const errorMsg = `错误: ${event.message} (${event.filename}:${event.lineno})`;
    if (window.debugLog) window.debugLog(errorMsg);
    
    // 显示错误提示
    const errorDiv = document.createElement('div');
    errorDiv.style.position = 'fixed';
    errorDiv.style.top = '50%';
    errorDiv.style.left = '50%';
    errorDiv.style.transform = 'translate(-50%, -50%)';
    errorDiv.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
    errorDiv.style.color = 'white';
    errorDiv.style.padding = '20px';
    errorDiv.style.borderRadius = '10px';
    errorDiv.style.zIndex = '10000';
    errorDiv.style.maxWidth = '90%';
    errorDiv.style.textAlign = 'center';
    errorDiv.innerHTML = `游戏加载错误<br>${event.message}<br>请检查控制台`;
    document.body.appendChild(errorDiv);
});

// 音频相关全局变量
let audioContext = null;
let audioBuffers = {}; // 确保这声明在全局范围内
let audioInitialized = false;
let activeSounds = {}; // 确保activeSounds也在全局范围内初始化

// 全局变量
let loadingProgressBar;
let loadingStatus;
let initialLoadComplete = false;

// 行动列表 (原音效列表) - 移到全局范围
const ACTION_TYPES = [
    '工作', '吃饭', '阅读', '听歌', '看剧', 
    '玩游戏', '聊天', '运动', '创作', '学习', 
    '刷手机', '上厕所', '闲逛', '炒股', '发呆', '睡觉'
];

document.addEventListener('DOMContentLoaded', () => {
    // 获取加载界面元素
    loadingProgressBar = document.getElementById('loading-progress-bar');
    loadingStatus = document.getElementById('loading-status');
    
    // 获取游戏开始界面和结算界面
    const startScreen = document.getElementById('startScreen'); 
    const startGameButton = document.getElementById('startGameButton');
    const loadingScreen = document.getElementById('loading-screen');
    const settlementScreen = document.getElementById('settlementScreen');
    const continueButton = document.getElementById('continueButton');
    const gameContainer = document.getElementById('gameContainer');
    
    // 开始初始化资源
    initializeResources().then(audioSuccess => {
        // 资源加载完成，显示开始游戏按钮
        loadingScreen.style.display = 'none';
        startScreen.style.display = 'flex'; // 使用flex布局
        
        // 显示音频加载状态
        if (!audioSuccess) {
            // 创建一个警告提示
            const audioWarning = document.createElement('div');
            audioWarning.className = 'audio-warning';
            audioWarning.innerHTML = '⚠️ 音频加载失败，游戏将以静音模式运行';
            audioWarning.style.color = '#ffcc00';
            audioWarning.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
            audioWarning.style.padding = '8px 12px';
            audioWarning.style.borderRadius = '4px';
            audioWarning.style.fontSize = '14px';
            audioWarning.style.margin = '10px auto';
            audioWarning.style.textAlign = 'center';
            audioWarning.style.maxWidth = '90%';
            
            // 将警告添加到开始界面
            const startContent = startScreen.querySelector('.start-content');
            if (startContent) {
                startContent.insertBefore(audioWarning, startGameButton);
            }
        }
        
        console.log('资源加载完成，显示开始界面' + (audioSuccess ? '' : '（无音频）'));
    }).catch(error => {
        // 资源加载失败，显示错误信息
        console.error('资源加载失败:', error);
        loadingStatus.textContent = '资源加载失败，请刷新页面重试。';
        loadingProgressBar.style.width = '100%';
        loadingProgressBar.style.backgroundColor = '#f44336';
        
        // 允许直接点击进入游戏，但显示警告
        setTimeout(() => {
            loadingScreen.style.display = 'none';
            startScreen.style.display = 'flex';
            
            // 创建错误警告
            const errorWarning = document.createElement('div');
            errorWarning.className = 'error-warning';
            errorWarning.innerHTML = '⚠️ 资源加载失败，游戏可能无法正常运行，建议刷新页面重试';
            errorWarning.style.color = '#ff4444';
            errorWarning.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
            errorWarning.style.padding = '10px 15px';
            errorWarning.style.borderRadius = '4px';
            errorWarning.style.fontSize = '14px';
            errorWarning.style.margin = '10px auto';
            errorWarning.style.textAlign = 'center';
            errorWarning.style.maxWidth = '90%';
            
            // 将警告添加到开始界面
            const startContent = startScreen.querySelector('.start-content');
            if (startContent) {
                startContent.insertBefore(errorWarning, startGameButton);
            }
        }, 3000); // 3秒后显示开始界面
    });
    
    // 点击开始游戏按钮
    startGameButton.addEventListener('click', () => {
        // 检查资源是否已加载完成
        if (!initialLoadComplete) {
            console.warn('游戏资源尚未加载完成，无法开始游戏');
            return;
        }
        
        // 开始游戏
        startGame();
    });
    
    // 点击继续演奏按钮
    if (continueButton) {
        continueButton.addEventListener('click', () => {
            // 注意：此事件监听器将被showSettlementScreen函数中的onclick属性覆盖
            // 保留此代码是为了向后兼容
            
            // 隐藏结算界面
            if (settlementScreen) {
                settlementScreen.style.display = 'none';
            }
            
            // 显示游戏界面
            gameContainer.style.display = 'flex';
            
            // 继续播放
            startPlayback();
        });
    }
    
    // 游戏初始化函数
    function initializeGame() {
        console.log('开始游戏初始化...');
        
        // 重构顶部布局
        restructureHeader();
        
        // 获取DOM元素
        if (!getDOMElements()) {
            console.error('无法获取关键DOM元素，中止初始化');
            window.debugLog && window.debugLog('DOM元素获取失败，可能需要刷新页面');
            return;
        }
        
        // 添加重置按钮事件监听
        const resetGameButton = document.getElementById('resetGameButton');
        if (resetGameButton) {
            resetGameButton.addEventListener('click', () => {
                // 确认用户真的想重置游戏
                if (confirm('确定要重新开始游戏吗？当前进度将丢失。')) {
                    resetPlayCount();
                    // 重新开始播放
                    if (!isPlaying) {
                        startPlayback();
                    }
                }
            });
        }
        
        // 初始化网格
        initGrid();
        
        // 初始化其他UI元素
        initTrackButtons();
        initPresetNotes();
        initAudio();
        
        // 更新显示
        updateStatsDisplay();
        updateSecondaryStats();
        updateAllActionButtonStyles();
        updateUnlockButtonState();
        
        console.log('游戏初始化完成');
    }

    // 常量定义
    const BPM = 140;
    const PLAY_LIMIT = 60;
    const GRID_COLUMNS = 8;
    const BEAT_DURATION = 60 / BPM; // 一拍的持续时间（秒）- 修正为60/BPM
    const ANIMATION_DURATION = BEAT_DURATION * GRID_COLUMNS; // 总动画时间
    
    // 已添加的行动（初始有2个）
    const addedActions = [
        { id: '工作', name: '工作' },
        { id: '吃饭', name: '吃饭' },
        { id: '刷手机', name: '刷手机' }
    ];
    
    // 声明引用变量，不使用const，以便可以重新赋值
    let trackList;
    let gridContainer;
    let playButton;
    let resetButton;
    let playCount;
    let playLimit;
    let addTrackButton;
    let playhead;
    let statsContainer;
    let compositionArea;
    
    // 获取DOM元素函数，在初始化和restructureHeader后调用
    function getDOMElements() {
        try {
            // 尝试获取所有必要的DOM元素
            trackList = null; // 不再使用轨道列表
            gridContainer = document.getElementById('gridContainer');
            playCount = document.getElementById('playCount');
            playLimit = document.getElementById('playLimit');
            playhead = document.querySelector('.playhead');
            statsContainer = document.getElementById('statsContainer');
            compositionArea = document.querySelector('.combined-area');
            
            // 记录找到的每个元素，用于调试
            console.log('获取DOM元素状态:', {
                gridContainer: !!gridContainer,
                playCount: !!playCount,
                playLimit: !!playLimit,
                playhead: !!playhead,
                statsContainer: !!statsContainer,
                compositionArea: !!compositionArea
            });
            
            // 检查是否所有必要的元素都被找到
            if (!gridContainer || !playCount || !playLimit || !playhead || 
                !statsContainer || !compositionArea) {
                
                const missingElements = [
                    !gridContainer ? 'gridContainer ' : '',
                    !playCount ? 'playCount ' : '',
                    !playLimit ? 'playLimit ' : '',
                    !playhead ? 'playhead ' : '',
                    !statsContainer ? 'statsContainer ' : '',
                    !compositionArea ? 'compositionArea ' : ''
                ].filter(el => el !== '').join(', ');
                
                console.error('DOM元素获取失败，页面可能无法正常初始化');
                console.error('缺失元素: ' + missingElements);
                
                if (window.debugLog) {
                    window.debugLog('DOM元素获取失败: ' + missingElements);
                }
                
                // 显示错误信息给用户
                const errorMessage = document.createElement('div');
                errorMessage.style.position = 'fixed';
                errorMessage.style.top = '50%';
                errorMessage.style.left = '50%';
                errorMessage.style.transform = 'translate(-50%, -50%)';
                errorMessage.style.backgroundColor = 'rgba(244, 67, 54, 0.9)';
                errorMessage.style.color = 'white';
                errorMessage.style.padding = '20px';
                errorMessage.style.borderRadius = '10px';
                errorMessage.style.zIndex = '9999';
                errorMessage.style.textAlign = 'center';
                errorMessage.innerHTML = `
                    <div style="font-weight:bold;margin-bottom:10px;">页面加载错误</div>
                    <div>无法获取必要的DOM元素：${missingElements}</div>
                    <div style="margin-top:15px;">请刷新页面重试</div>
                    <button id="reloadButton" style="margin-top:10px;padding:5px 15px;background:#fff;color:#f44336;border:none;border-radius:5px;cursor:pointer;">刷新页面</button>
                `;
                document.body.appendChild(errorMessage);
                
                // 添加刷新按钮事件
                document.getElementById('reloadButton').addEventListener('click', () => {
                    window.location.reload();
                });
                
                return false; // 获取元素失败
            }
            
            // 如果使用调试工具，记录元素获取成功
            if (window.debugLog) {
                window.debugLog('所有DOM元素获取成功');
            }
            
            return true; // 获取元素成功
        } catch (error) {
            console.error('获取DOM元素时发生错误:', error);
            if (window.debugLog) {
                window.debugLog('获取DOM元素错误: ' + error.message);
            }
            return false;
        }
    }
    
    // 先尝试获取DOM元素
    if (!getDOMElements()) {
        return; // 中止初始化
    }
    
    // 基于解锁次数计算见闻需求
    function calculateKnowledgeRequirement(unlockCount) {
        // 初始两个行动无需见闻值（工作和吃饭）
        // 从第4个行动开始需要见闻值
        const baseRequirement = 10; // 第一次解锁需要10点见闻
        const increaseRate = 10 * unlockCount;    // 每次增加10*解锁次数
        
        if (unlockCount < 3) {
            return 0;
        }
        
        // 解锁次数从0开始计算，所以第4个行动是unlockCount=3
        return baseRequirement + (unlockCount - 3) * increaseRate;
    }
    
    // 游戏状态
    let isPlaying = false;
    let playCounter = 0; // 天数计数
    let animationId = null;
    let startTime = 0;
    let lastCycleTime = 0; // 记录上次循环计数的时间
    let lastTriggeredColumn = -1; // 记录上一次触发的列号
    
    // 玩家属性
    const playerStats = {
        金钱: 0,
        见闻: 0,
        欲望: 0,
        效率: 1,  // 新增效率属性，初始值为1
        耐心: 3   // 新增耐心属性，初始值为3
    };
    
    // 音频上下文（已在全局定义，这里不需要重复定义）
    // let audioContext;
    // let audioBuffers = {};
    // let audioInitialized = false; 
    
    // 音符数据（行动 => 列位置的集合）
    const noteData = {};
    
    // 行动对属性的影响映射
    const ACTION_EFFECTS = {
        '工作': { 金钱: 2, 欲望: 1 },
        '吃饭': { 金钱: -1, 欲望: -1 },
        '阅读': { 见闻: 2, 欲望: -1 },
        '听歌': { 见闻: 1, 欲望: -1 },
        '看剧': { 见闻: 1, 欲望: -1 },
        '玩游戏': { 见闻: 1, 欲望: 1 },
        '聊天': { 见闻: 1, 欲望: 2 },
        '运动': { 见闻: 1, 欲望: -2 },
        '创作': { 见闻: 2, 欲望: -1 },
        '学习': { 见闻: 5 },
        '刷手机': { 见闻: 2 , 欲望: 1 },
        '上厕所': { 见闻: -1, 欲望: -1 },
        '闲逛': { 见闻: 1 },
        '冲咖啡': { 欲望: -1 },
        '炒股': { 金钱: 0, 欲望: 1 },
        '发呆': { 欲望: -1 },
        '睡觉': { 欲望: -2 },
    };
    
    // 行动emoji和效果映射
    const ACTION_EMOJIS = {
        '工作': '💼',
        '吃饭': '🍚',
        '阅读': '📚',
        '听歌': '🎵',
        '看剧': '📺',
        '玩游戏': '🎮',
        '聊天': '💬',
        '运动': '🏃',
        '创作': '✍️',
        '学习': '📝',
        '刷手机': '📱',
        '上厕所': '🚽',
        '闲逛': '🚶',
        '炒股': '📈',
        '发呆': '😶',
        '睡觉': '😴'
    };
    
    // 设置播放限制
    if (playLimit) {
        playLimit.textContent = PLAY_LIMIT;
    }
    
    // 更新玩家属性显示
    function updateStatsDisplay() {
        // 清空现有统计信息
        statsContainer.innerHTML = '';
        
        // 创建属性列表容器
        const statsList = document.createElement('div');
        statsList.className = 'stats-list';
        
        // 创建三大属性的音量条样式
        const attributeColors = {
            '金钱': {
                background: '#ffd700', // 金色背景
                color: '#000',         // 黑色文字
                barClass: 'money-bar',
                icon: '💰'             // 金钱图标
            },
            '见闻': {
                background: '#4caf50', // 绿色背景
                color: '#fff',         // 白色文字
                barClass: 'knowledge-bar',
                icon: '📚'             // 见闻图标
            },
            '欲望': {
                background: '#ff5252', // 红色背景
                color: '#fff',         // 白色文字
                barClass: 'desire-bar',
                icon: '🔥'             // 欲望图标
            }
        };
        
        // 添加三大主要属性的音量条
        ['金钱', '见闻', '欲望'].forEach(attr => {
            const statRow = document.createElement('div');
            statRow.className = 'stat-row';
            
            // 属性名称容器
            const statName = document.createElement('div');
            statName.className = 'stat-title';
            
            // 添加图标
            const iconSpan = document.createElement('span');
            iconSpan.className = 'stat-icon';
            iconSpan.textContent = attributeColors[attr].icon;
            statName.appendChild(iconSpan);
            
            // 添加属性名称
            const nameSpan = document.createElement('span');
            nameSpan.textContent = attr;
            statName.appendChild(nameSpan);
            
            statName.style.color = attributeColors[attr].color;
            statName.style.backgroundColor = attributeColors[attr].background;
            statRow.appendChild(statName);
            
            // 音量条容器
            const barContainer = document.createElement('div');
            barContainer.className = `volume-bar-container ${attributeColors[attr].barClass}`;
            
            // 音量条本身
            const bar = document.createElement('div');
            bar.className = `volume-bar`;
            bar.style.backgroundColor = attributeColors[attr].background;
            
            // 创建残影层
            const trailBar = document.createElement('div');
            trailBar.className = `volume-bar-trail`;
            
            // 根据数值设置宽度比例 - 使用随机值作为纯视觉特效
            // 为了保持一定的关联性，我们根据属性值进行加权随机
            let percentage;
            
            if (attr === '欲望') {
                // 欲望：保持一定关联性但仍然随机
                const basePercentage = Math.min(100, (playerStats[attr] / Math.max(1, playerStats.金钱)) * 100);
                // 加权随机：真实值占70%权重，随机值占30%权重
                percentage = basePercentage * 0.5 + (Math.random() * 50); // 50%真实值+随机值
            } else if (attr === '金钱') {
                // 金钱：作为主要属性，保持较高的真实性
                const basePercentage = Math.min(100, 100 * Math.log(1 + playerStats[attr] / 10) / Math.log(11));
                percentage = basePercentage * 0.6 + (Math.random() * 40); // 60%真实值+随机值
            } else {
                // 见闻：中等程度的随机性
                const basePercentage = Math.min(100, 100 * Math.log(1 + playerStats[attr] / 10) / Math.log(11));
                percentage = basePercentage * 0.5 + (Math.random() * 50); // 50%真实值+随机值
            }
            
            // 确保百分比在有效范围内
            percentage = Math.min(100, Math.max(5, percentage));
            
            bar.style.width = `${percentage}%`;
            
            // 获取上次存储的残影宽度
            const trailWidth = barContainer.getAttribute('data-trail-width');
            
            // 如果新的宽度大于残影宽度，更新残影宽度
            if (!trailWidth || parseFloat(percentage) > parseFloat(trailWidth)) {
                trailBar.style.width = `${percentage}%`;
                barContainer.setAttribute('data-trail-width', percentage);
            } else {
                // 否则使用之前的残影宽度（它会通过CSS动画自动缩小到0）
                trailBar.style.width = `${trailWidth}%`;
            }
            
            // 添加值变化动画的处理
            const oldValue = bar.getAttribute('data-old-value');
            const newValue = playerStats[attr];
            if (oldValue && oldValue != newValue) {
                // 添加动画类
                bar.classList.add('volume-bar-animate');
                
                // 一段时间后移除动画类
                setTimeout(() => {
                    bar.classList.remove('volume-bar-animate');
                }, 1000);
            }
            // 存储当前值，以便下次比较
            bar.setAttribute('data-old-value', newValue);
            
            // 先添加残影层，再添加主进度条（确保主进度条在上层）
            barContainer.appendChild(trailBar);
            barContainer.appendChild(bar);
            statRow.appendChild(barContainer);
            
            // 数值显示
            const statValue = document.createElement('div');
            statValue.className = 'stat-value';
            statValue.textContent = playerStats[attr];
            statRow.appendChild(statValue);
            
            statsList.appendChild(statRow);
        });
        
        statsContainer.appendChild(statsList);
    }
    
    // 初始化统计显示
    updateStatsDisplay();
    
    // 初始化网格
    function initGrid() {
        const gridContainer = document.getElementById('gridContainer');
        gridContainer.innerHTML = '';
        gridContainer.style.display = 'grid';
        // 减少行动名称区域宽度至原来的60%（从150px减少到90px）
        gridContainer.style.gridTemplateColumns = `90px repeat(${GRID_COLUMNS}, 1fr)`;
        
        // 创建网格
        for (let row = 0; row < addedActions.length; row++) {
            const actionId = addedActions[row].id;
            
            // 初始化这个动作的音符数据
            if (!noteData[actionId]) {
                noteData[actionId] = {};
            }
            
            // 首先创建轨道按钮作为第一列
            const button = document.createElement('button');
            button.className = 'track-button';
            button.setAttribute('data-action', actionId);
            button.setAttribute('data-row', row);
            button.style.gridRow = row + 1;
            button.style.gridColumn = 1;
            
            // 创建标题行（包含emoji和名称）
            const actionHeader = document.createElement('div');
            actionHeader.className = 'action-header';
            
            // 创建emoji容器
            const emojiSpan = document.createElement('span');
            emojiSpan.className = 'action-emoji';
            emojiSpan.textContent = ACTION_EMOJIS[actionId] || '';
            actionHeader.appendChild(emojiSpan);
            
            // 创建行动名称
            const nameSpan = document.createElement('span');
            nameSpan.className = 'action-name';
            nameSpan.textContent = actionId;
            actionHeader.appendChild(nameSpan);
            
            // 将标题行添加到按钮
            button.appendChild(actionHeader);
            
            // 创建效果容器
            const effectSpan = document.createElement('div');
            effectSpan.className = 'action-effect';
            
            // 简化行动效果显示
            if (ACTION_EFFECTS[actionId]) {
                // 遍历属性影响
                Object.entries(ACTION_EFFECTS[actionId]).forEach(([stat, value]) => {
                    // 创建效果图标
                    const effectIconSpan = document.createElement('span');
                    effectIconSpan.className = 'effect-icon';
                    
                    // 根据属性类型选择图标
                    let icon = '';
                    if (stat === '金钱') icon = '💰';
                    else if (stat === '见闻') icon = '📚';
                    else if (stat === '欲望') icon = '🔥';
                    
                    // 添加符号
                    if (value >= 0) {
                        effectIconSpan.className += ' positive-effect';
                        effectIconSpan.textContent = `${icon}`;
                    } else {
                        effectIconSpan.className += ' negative-effect';
                        effectIconSpan.textContent = `${icon}`;
                    }
                    
                    effectSpan.appendChild(effectIconSpan);
                });
            }
            
            button.appendChild(effectSpan);
            
            // 将按钮添加到网格
            gridContainer.appendChild(button);
            
            // 为每个动作创建8列的网格单元格
            for (let col = 0; col < GRID_COLUMNS; col++) {
                const cell = document.createElement('div');
                cell.className = 'grid-cell';
                cell.setAttribute('data-action', actionId);
                cell.setAttribute('data-column', col);
                cell.setAttribute('data-row', row);
                cell.style.gridRow = row + 1; // 确保精确的网格位置
                cell.style.gridColumn = col + 2; // +2 是因为第一列是轨道按钮
                
                // 检查是否已经有音符
                if (noteData[actionId][col]) {
                    cell.classList.add('active');
                    
                    // 添加emoji
                    const emojiSpan = document.createElement('span');
                    emojiSpan.className = 'action-emoji-cell';
                    emojiSpan.textContent = ACTION_EMOJIS[actionId] || '';
                    cell.appendChild(emojiSpan);
                }
                
                cell.addEventListener('click', () => {
                    toggleNote(actionId, col, cell);
                });
                
                gridContainer.appendChild(cell);
            }
        }
        
        // 添加"+"按钮作为最后一行的第一列
        const addButton = document.createElement('button');
        addButton.className = 'track-button';
        addButton.id = 'addTrackButtonInGrid'; // 新ID，避免与原来的冲突
        addButton.disabled = true;
        addButton.textContent = "需要见闻值解锁";
        addButton.style.gridRow = addedActions.length + 1;
        addButton.style.gridColumn = 1;
        addButton.addEventListener('click', updateUnlockButtonState);
        gridContainer.appendChild(addButton);
        
        // 替换原来的addTrackButton的引用
        addTrackButton = addButton;
        
        // 添加一个额外的空白行作为最后一行的其余列
        for (let col = 0; col < GRID_COLUMNS; col++) {
            const placeholderCell = document.createElement('div');
            placeholderCell.className = 'grid-cell placeholder-cell';
            placeholderCell.setAttribute('data-column', col);
            placeholderCell.setAttribute('data-row', addedActions.length);
            placeholderCell.style.gridRow = addedActions.length + 1; // 确保精确的网格位置
            placeholderCell.style.gridColumn = col + 2; // +2 是因为第一列是轨道按钮
            placeholderCell.style.pointerEvents = 'none'; // 禁用交互
            
            // 添加占位符图标
            const placeholderSpan = document.createElement('span');
            placeholderSpan.style.opacity = '0.3';
            placeholderSpan.textContent = '🔍'; // 解锁图标
            placeholderCell.appendChild(placeholderSpan);
            
            gridContainer.appendChild(placeholderCell);
        }
        
        // 计算精确的网格高度
        const rowHeight = 70; // 每行高度
        const totalHeight = (addedActions.length + 1) * rowHeight;
        
        // 设置网格容器高度
        gridContainer.style.height = `${totalHeight}px`;
    }
    
    // 检查是否超过耐心限制（连续激活的数量）
    function checkPatienceLimit(action, column) {
        // 检查当前行的列，看看连续段会不会超过耐心限制
        const patienceLimit = playerStats.耐心;
        
        // 如果当前位置已经激活，则不需要检查（因为是取消激活操作）
        if (noteData[action][column]) {
            return false;
        }
        
        // 找到当前位置左边第一个非激活格的位置
        let leftBound = column - 1;
        while (leftBound >= 0 && noteData[action][leftBound]) {
            leftBound--;
        }
        
        // 找到当前位置右边第一个非激活格的位置
        let rightBound = column + 1;
        while (rightBound < GRID_COLUMNS && noteData[action][rightBound]) {
            rightBound++;
        }
        
        // 计算新的连续长度（右边界 - 左边界 - 1）
        // 因为左边界和右边界都是指向非激活格的位置
        const continuousLength = rightBound - leftBound - 1;
        
        // 返回是否超过耐心限制
        return continuousLength > patienceLimit;
    }
    
    // 切换音符状态
    function toggleNote(action, column, cell) {
        // 如果要激活音符
        if (!cell.classList.contains('active')) {
            // 计算当前列已激活的行动数量
            const activeNotesInColumn = document.querySelectorAll(`.grid-cell[data-column="${column}"].active`).length;
            
            // 检查是否超过效率限制
            if (activeNotesInColumn >= playerStats.效率) {
                // 显示效率限制提示
                showEfficiencyLimitMessage(column, playerStats.效率);
                return; // 不允许激活
            }
            
            // 检查是否超过耐心限制（连续激活）
            if (checkPatienceLimit(action, column)) {
                // 显示耐心限制提示
                showPatienceLimitMessage(action, playerStats.耐心);
                return; // 不允许激活
            }
            
            cell.classList.add('active');
            if (!noteData[action]) {
                noteData[action] = {};
            }
            noteData[action][column] = true;
            
            // 添加emoji到激活的单元格
            cell.innerHTML = '';
            const emojiSpan = document.createElement('span');
            emojiSpan.className = 'action-emoji-cell';
            emojiSpan.textContent = ACTION_EMOJIS[action] || '';
            cell.appendChild(emojiSpan);
            
            // 如果不在播放中，播放单个音符预览
            if (!isPlaying) {
                playSound(action);
            }
        } else {
            // 移除激活状态
            cell.classList.remove('active');
            cell.innerHTML = '';
            delete noteData[action][column];
        }
    }
    
    // 初始化音频
    async function initAudio() {
        if (audioInitialized) {
            console.log('音频已经初始化，跳过初始化过程');
            return true;
        }
        
        console.log('开始初始化音频...');
        window.debugLog && window.debugLog('开始初始化音频...');
        
        try {
            console.log('ACTION_TYPES:', ACTION_TYPES);
            
            // 分批加载音频文件以避免并发连接限制
            // 首先准备所有需要加载的音频文件信息
            const audioFiles = [];
            
            // 添加基础节奏音频（优先级最高）
            audioFiles.push({ 
                id: 'base_rhythm', 
                filename: 'base_rhythm',
                loaded: false,
                attempts: 0,
                priority: 1 // 优先级最高
            });
            
            // 添加所有行动对应的音频
            for (const action of ACTION_TYPES) {
                const soundFileName = `snd_${actionToFileName(action)}`;
                audioFiles.push({ 
                    id: action, 
                    filename: soundFileName,
                    loaded: false,
                    attempts: 0,
                    priority: 2 // 普通优先级
                });
            }
            
            // 按优先级排序
            audioFiles.sort((a, b) => a.priority - b.priority);
            
            // 计算每个音频文件的加载进度权重
            const totalFiles = audioFiles.length;
            const baseProgress = 10; // 起始进度
            const maxProgress = 95; // 最大进度
            const progressPerFile = (maxProgress - baseProgress) / totalFiles;
            
            // 检测是否为移动设备
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            
            // 根据设备类型设置每批加载数量，移动设备更少
            const batchSize = isMobile ? 2 : 3;
            // 增加移动设备的最大尝试次数
            const maxAttempts = isMobile ? 4 : 3;
            let loadSuccessCount = 0;
            let loadFailCount = 0;
            
            console.log(`开始分批加载音频，每批${batchSize}个文件，设备类型: ${isMobile ? '移动' : '桌面'}`);
            window.debugLog && window.debugLog(`分批加载音频，每批${batchSize}个`);
            updateLoadingStatus(`开始加载音频文件 (0/${totalFiles})`, baseProgress);
            
            // 显示音频加载进度条
            showAudioLoadingProgressBar();
            
            // 分批加载函数
            async function loadBatch(startIndex) {
                if (startIndex >= audioFiles.length) {
                    // 所有批次都已加载完成
                    console.log(`音频批量加载完成: 成功 ${loadSuccessCount} 个, 失败 ${loadFailCount} 个`);
                    window.debugLog && window.debugLog(`音频加载: 成功 ${loadSuccessCount}, 失败 ${loadFailCount}`);
                    updateLoadingStatus(`音频加载完成: 成功 ${loadSuccessCount} 个, 失败 ${loadFailCount} 个`, 95);
                    
                    // 隐藏音频加载进度条
                    hideAudioLoadingProgressBar();
                    
                    // 检查是否有未加载的音频需要重试
                    const unloadedFiles = audioFiles.filter(file => !file.loaded && file.attempts < maxAttempts);
                    
                    if (unloadedFiles.length > 0) {
                        console.log(`重试加载 ${unloadedFiles.length} 个未加载的音频文件`);
                        window.debugLog && window.debugLog(`重试加载 ${unloadedFiles.length} 个音频`);
                        updateLoadingStatus(`重试加载失败的音频文件 (${unloadedFiles.length}个)...`, 95);
                        
                        // 重新显示加载进度条
                        showAudioLoadingProgressBar(`重试加载 (${unloadedFiles.length}个)`);
                        
                        // 重置索引，开始重试
                        for (const file of unloadedFiles) {
                            file.attempts++;
                        }
                        
                        // 在移动设备上添加延迟，给浏览器一些恢复时间
                        if (isMobile) {
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                        
                        // 重新加载第一批未加载的文件
                        return loadBatch(0);
                    }
                    
                    // 对于仍未加载的文件，使用备用音效
                    const stillUnloadedFiles = audioFiles.filter(file => !file.loaded);
                    if (stillUnloadedFiles.length > 0) {
                        console.log(`${stillUnloadedFiles.length} 个音频文件无法加载，使用备用音效`);
                        
                        for (const file of stillUnloadedFiles) {
                            console.log(`音频 ${file.filename} 在 ${file.attempts} 次尝试后仍未加载，使用备用音效`);
                            window.debugLog && window.debugLog(`使用备用音效: ${file.filename}`);
                            
                            if (file.id === 'base_rhythm') {
                                console.log('使用空白音频作为基础节奏');
                                audioBuffers['base_rhythm'] = createEmptyBuffer();
                            } else {
                                console.log(`为行动 ${file.id} 生成备用音效`);
                                const buffer = await generateSound(file.id);
                                audioBuffers[file.id] = buffer;
                            }
                        }
                    }
                    
                    // 列出所有加载的音频
                    console.log('已加载的音频缓冲区:', Object.keys(audioBuffers));
                    
                    // 初始化完成
                    audioInitialized = true;
                    // 如果所有文件都加载成功或者使用了备用音效，返回成功
                    return (loadSuccessCount > 0);
                }
                
                // 计算当前批次的结束索引
                const endIndex = Math.min(startIndex + batchSize, audioFiles.length);
                const currentBatch = audioFiles.slice(startIndex, endIndex);
                const batchNumber = Math.floor(startIndex / batchSize) + 1;
                const totalBatches = Math.ceil(audioFiles.length / batchSize);
                
                console.log(`加载第 ${batchNumber}/${totalBatches} 批音频 (${currentBatch.length} 个文件)`);
                window.debugLog && window.debugLog(`加载第 ${batchNumber} 批音频`);
                updateLoadingStatus(`加载音频 - 批次 ${batchNumber}/${totalBatches}`, baseProgress + progressPerFile * startIndex);
                
                // 更新音频加载进度条
                updateAudioLoadingProgress((startIndex / audioFiles.length) * 100);
                
                // 找出当前批次中未加载且尝试次数小于最大尝试次数的文件
                const filesToLoad = currentBatch.filter(file => !file.loaded && file.attempts < maxAttempts);
                
                // 如果当前批次中没有需要加载的文件，直接加载下一批
                if (filesToLoad.length === 0) {
                    return loadBatch(endIndex);
                }
                
                // 加载当前批次中的文件
                const promises = filesToLoad.map(file => {
                    console.log(`尝试加载音频 ${file.filename}.mp3 (第 ${file.attempts + 1} 次尝试)`);
                    window.debugLog && window.debugLog(`加载 ${file.filename}.mp3`);
                    
                    return loadSound(file.filename)
                        .then(buffer => {
                            console.log(`音频 ${file.filename} 加载成功`);
                            window.debugLog && window.debugLog(`${file.filename} 加载成功`);
                            
                            // 保存音频缓冲区
                            audioBuffers[file.id] = buffer;
                            file.loaded = true;
                            loadSuccessCount++;
                            
                            // 更新进度显示
                            const currentProgress = baseProgress + progressPerFile * (startIndex + loadSuccessCount);
                            updateLoadingStatus(`已加载 ${loadSuccessCount}/${totalFiles} 个音频文件`, currentProgress);
                            
                            return buffer;
                        })
                        .catch(error => {
                            console.warn(`音频 ${file.filename} 加载失败 (尝试 ${file.attempts + 1}/${maxAttempts}):`, error);
                            window.debugLog && window.debugLog(`${file.filename} 加载失败`);
                            
                            // 增加尝试次数
                            file.attempts++;
                            
                            if (file.attempts >= maxAttempts) {
                                loadFailCount++;
                            }
                            
                            // 标记为未加载
                            file.loaded = false;
                            
                            return null;
                        });
                });
                
                // 等待当前批次完成
                await Promise.all(promises);
                
                // 短暂延迟，让浏览器有时间释放连接
                // 移动设备上使用更长的延迟
                const delayTime = isMobile ? 800 : 500;
                await new Promise(resolve => setTimeout(resolve, delayTime));
                
                // 加载下一批
                return loadBatch(endIndex);
            }
            
            // 开始加载第一批
            const loadResult = await loadBatch(0);
            
            return loadResult;
        } catch (error) {
            console.error('初始化音频失败:', error);
            window.debugLog && window.debugLog(`音频初始化失败: ${error.message}`);
            
            // 隐藏音频加载进度条
            hideAudioLoadingProgressBar();
            
            // 初始化备用音效
            console.log('使用备用音效系统');
            window.debugLog && window.debugLog('使用备用音效系统');
            updateLoadingStatus('音频加载失败，使用备用音效系统...', 90);
            
            try {
                // 为所有行动生成备用音效
                for (const action of ACTION_TYPES) {
                    const buffer = await generateSound(action);
                    audioBuffers[action] = buffer;
                }
                
                // 创建一个空白的背景节奏
                audioBuffers['base_rhythm'] = createEmptyBuffer();
                
                // 标记为初始化完成
                audioInitialized = true;
                return true; // 使用备用音效成功
            } catch (fallbackError) {
                console.error('备用音效也初始化失败:', fallbackError);
                window.debugLog && window.debugLog(`备用音效初始化失败: ${fallbackError.message}`);
                return false;
            }
        }
    }

    // 显示音频加载进度条
    function showAudioLoadingProgressBar(title = '加载音频中') {
        // 检查是否已存在进度条
        let progressContainer = document.getElementById('audio-loading-progress-container');
        if (progressContainer) {
            // 如果存在则更新标题
            const titleElement = progressContainer.querySelector('.audio-loading-title');
            if (titleElement) {
                titleElement.textContent = title;
            }
            progressContainer.style.display = 'flex';
            return;
        }
        
        // 创建进度条容器
        progressContainer = document.createElement('div');
        progressContainer.id = 'audio-loading-progress-container';
        progressContainer.style.position = 'fixed';
        progressContainer.style.top = '50%';
        progressContainer.style.left = '50%';
        progressContainer.style.transform = 'translate(-50%, -50%)';
        progressContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        progressContainer.style.padding = '20px';
        progressContainer.style.borderRadius = '10px';
        progressContainer.style.zIndex = '9999';
        progressContainer.style.display = 'flex';
        progressContainer.style.flexDirection = 'column';
        progressContainer.style.alignItems = 'center';
        progressContainer.style.color = 'white';
        progressContainer.style.width = '80%';
        progressContainer.style.maxWidth = '400px';
        
        // 添加标题
        const titleElement = document.createElement('div');
        titleElement.className = 'audio-loading-title';
        titleElement.textContent = title;
        titleElement.style.marginBottom = '10px';
        titleElement.style.fontWeight = 'bold';
        progressContainer.appendChild(titleElement);
        
        // 添加进度条背景
        const progressBarBg = document.createElement('div');
        progressBarBg.className = 'audio-loading-progress-bg';
        progressBarBg.style.width = '100%';
        progressBarBg.style.height = '10px';
        progressBarBg.style.backgroundColor = '#444';
        progressBarBg.style.borderRadius = '5px';
        progressBarBg.style.overflow = 'hidden';
        
        // 添加进度条前景
        const progressBar = document.createElement('div');
        progressBar.className = 'audio-loading-progress';
        progressBar.style.width = '0%';
        progressBar.style.height = '100%';
        progressBar.style.backgroundColor = '#4CAF50';
        progressBar.style.borderRadius = '5px';
        progressBar.style.transition = 'width 0.3s ease';
        
        progressBarBg.appendChild(progressBar);
        progressContainer.appendChild(progressBarBg);
        
        // 添加进度文本
        const progressText = document.createElement('div');
        progressText.className = 'audio-loading-progress-text';
        progressText.textContent = '0%';
        progressText.style.marginTop = '5px';
        progressContainer.appendChild(progressText);
        
        // 添加到页面
        document.body.appendChild(progressContainer);
    }
    
    // 更新音频加载进度
    function updateAudioLoadingProgress(percent) {
        const progressContainer = document.getElementById('audio-loading-progress-container');
        if (!progressContainer) return;
        
        const progressBar = progressContainer.querySelector('.audio-loading-progress');
        const progressText = progressContainer.querySelector('.audio-loading-progress-text');
        
        if (progressBar) {
            progressBar.style.width = `${percent}%`;
        }
        
        if (progressText) {
            progressText.textContent = `${Math.round(percent)}%`;
        }
    }
    
    // 隐藏音频加载进度条
    function hideAudioLoadingProgressBar() {
        const progressContainer = document.getElementById('audio-loading-progress-container');
        if (progressContainer) {
            // 渐变消失
            progressContainer.style.opacity = '0';
            progressContainer.style.transition = 'opacity 0.5s ease';
            
            // 一段时间后移除
            setTimeout(() => {
                if (progressContainer.parentNode) {
                    progressContainer.parentNode.removeChild(progressContainer);
                }
            }, 500);
        }
    }

    // 创建空白的音频缓冲区
    function createEmptyBuffer() {
        if (!audioContext) {
            console.warn('音频上下文未初始化，无法创建空白缓冲区');
            // 创建一个伪缓冲区对象作为替代
            return {
                duration: 0.1,
                numberOfChannels: 1,
                length: 4410, // 44100 * 0.1，标准采样率0.1秒的长度
                getChannelData: function() {
                    return new Float32Array(4410);
                }
            };
        }
        
        const sampleRate = audioContext.sampleRate;
        const duration = 0.1; // 很短的声音
        const frameCount = sampleRate * duration;
        
        const audioBuffer = audioContext.createBuffer(1, frameCount, sampleRate);
        const channelData = audioBuffer.getChannelData(0);
        
        // 填充静音数据
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = 0;
        }
        
        return audioBuffer;
    }
    
    // 加载音频文件的函数
    function loadSound(filename) {
        // 修复文件名（确保base_rhythm拼写正确）
        if (filename === 'base_rythm') {
            filename = 'base_rhythm';
        }
        
        console.log(`尝试加载音频: ${filename}.mp3`);
        window.debugLog && window.debugLog(`尝试加载音频: ${filename}.mp3`);
        
        // 获取当前页面URL的路径部分
        const baseUrl = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
        const relativeUrl = `sounds/${filename}.mp3`;
        const absoluteUrl = new URL(relativeUrl, baseUrl).href;
        
        console.log(`音频文件相对URL: ${relativeUrl}`);
        console.log(`音频文件绝对URL: ${absoluteUrl}`);
        window.debugLog && window.debugLog(`音频文件URL: ${absoluteUrl}`);
        
        return new Promise((resolve, reject) => {
            // 检测是否为移动设备
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            
            // 移动设备使用更长的超时时间
            const timeoutDuration = isMobile ? 15000 : 10000;
            
            // 添加超时处理
            const timeoutId = setTimeout(() => {
                console.warn(`加载音频${filename}超时`);
                window.debugLog && window.debugLog(`音频加载超时: ${filename}.mp3`);
                reject(new Error('加载超时'));
            }, timeoutDuration);
            
            // 检查文件是否存在
            fetch(absoluteUrl, {
                // 添加缓存控制，避免移动浏览器缓存失败的请求
                cache: 'no-store',
                // 增加优先级
                priority: 'high'
            })
            .then(response => {
                console.log(`音频文件 ${filename}.mp3 响应状态:`, response.status);
                window.debugLog && window.debugLog(`音频文件 ${filename}.mp3 响应状态: ${response.status}`);
                
                if (!response.ok) {
                    throw new Error(`HTTP错误! 状态: ${response.status}`);
                }
                return response.arrayBuffer();
            })
            .then(arrayBuffer => {
                console.log(`音频文件 ${filename}.mp3 成功获取为ArrayBuffer, 大小: ${arrayBuffer.byteLength} 字节`);
                window.debugLog && window.debugLog(`音频文件 ${filename}.mp3 大小: ${arrayBuffer.byteLength} 字节`);
                
                if (!audioContext) {
                    throw new Error('音频上下文不存在');
                }
                
                // 在移动设备上，解码前添加短暂延迟，避免同时解码多个文件
                if (isMobile) {
                    return new Promise(resolve => {
                        setTimeout(() => {
                            resolve(audioContext.decodeAudioData(arrayBuffer));
                        }, 100);
                    });
                } else {
                    return audioContext.decodeAudioData(arrayBuffer);
                }
            })
            .then(audioBuffer => {
                // 清除超时
                clearTimeout(timeoutId);
                
                console.log(`音频文件 ${filename}.mp3 成功解码为AudioBuffer, 时长: ${audioBuffer.duration}秒`);
                window.debugLog && window.debugLog(`音频文件 ${filename}.mp3 解码成功, 时长: ${audioBuffer.duration}秒`);
                resolve(audioBuffer);
            })
            .catch(error => {
                // 清除超时
                clearTimeout(timeoutId);
                
                console.error(`加载音频${filename}失败:`, error);
                window.debugLog && window.debugLog(`音频加载失败: ${filename}.mp3 - ${error.message}`);
                reject(error);
            });
        });
    }
    
    // 获取备用音效
    function getFallbackSound(filename) {
        const fallbackMap = {
            'snd_sleep': 'snd_daydreaming',  // 睡觉使用发呆的音效
            // 可以添加更多的备用音效映射
        };
        return fallbackMap[filename];
    }
    
    // 将行动名称转换为文件名
    function actionToFileName(action) {
        const actionMap = {
            '工作': 'work',
            '吃饭': 'eat',
            '阅读': 'read',
            '听歌': 'music',
            '看剧': 'drama',
            '玩游戏': 'game',
            '聊天': 'chat',
            '运动': 'sport',
            '创作': 'create',
            '学习': 'study',
            '刷手机': 'phone',
            '上厕所': 'toilet',
            '闲逛': 'walk',
            '炒股': 'stock',
            '发呆': 'daydreaming',
            '睡觉': 'sleep' // 暂时用发呆的音效代替睡觉
        };
        
        return actionMap[action] || action.toLowerCase();
    }
    
    // 生成简单的合成声音 (作为备用音效)
    function generateSound(action) {
        return new Promise((resolve) => {
            if (!audioContext) {
                console.warn('音频上下文未初始化，无法生成音效');
                // 创建一个伪缓冲区对象作为替代
                resolve({
                    duration: 0.5,
                    numberOfChannels: 1,
                    length: 22050, // 44100 * 0.5，标准采样率0.5秒的长度
                    getChannelData: function() {
                        return new Float32Array(22050);
                    }
                });
                return;
            }
            
            const sampleRate = audioContext.sampleRate;
            const duration = 0.5; // 声音持续时间（秒）
            const frameCount = sampleRate * duration;
            
            const audioBuffer = audioContext.createBuffer(1, frameCount, sampleRate);
            const channelData = audioBuffer.getChannelData(0);
            
            let frequency = 440; // 默认频率
            let waveType = 'sine'; // 默认波形
            
            // 根据行动类型设置不同的频率和波形
            // 工作类
            if (action === '工作' || action === '学习') {
                frequency = 55;
                waveType = 'triangle';
            } 
            // 休闲类
            else if (action === '吃饭' || action === '冲咖啡' || action === '上厕所') {
                frequency = 220;
                waveType = 'square';
            } 
            // 娱乐类
            else if (action === '阅读' || action === '看剧' || action === '刷手机') {
                frequency = 261.63; // C4
                waveType = 'sine';
            } 
            // 社交类
            else if (action === '聊天' || action === '闲逛') {
                frequency = 329.63; // E4
                waveType = 'sawtooth';
            } 
            // 放松类
            else if (action === '听歌' || action === '发呆' || action === '睡觉') {
                frequency = 196; // G3
                waveType = 'triangle';
            } 
            // 活跃类
            else if (action === '运动' || action === '玩游戏' || action === '创作') {
                frequency = 98; // G2
                waveType = 'sawtooth';
            } 
            // 特殊类
            else if (action === '炒股') {
                frequency = 440; // A4
                waveType = 'square';
            }
            
            // 填充音频数据
            for (let i = 0; i < frameCount; i++) {
                const t = i / sampleRate;
                let sample = 0;
                
                // 根据波形类型生成不同的波形
                switch (waveType) {
                    case 'sine':
                        sample = Math.sin(2 * Math.PI * frequency * t);
                        break;
                    case 'square':
                        sample = Math.sign(Math.sin(2 * Math.PI * frequency * t));
                        break;
                    case 'sawtooth':
                        sample = 2 * (t * frequency - Math.floor(0.5 + t * frequency));
                        break;
                    case 'triangle':
                        sample = Math.abs(2 * (t * frequency - Math.floor(t * frequency + 0.5))) * 2 - 1;
                        break;
                }
                
                // 应用衰减包络
                const envelope = Math.exp(-5 * t);
                channelData[i] = sample * envelope * 0.5; // 减小音量
            }
            
            resolve(audioBuffer);
        });
    }
    
    // 播放声音并更新玩家属性
    function playSound(actionId, updateStats = false) {
        try {
            if (!audioContext || audioContext.state !== 'running') {
                console.warn('音频上下文未准备好:', audioContext?.state);
                return;
            }
            
            // 确保音频缓冲区存在
            if (!audioBuffers[actionId]) {
                console.warn('未找到音效:', actionId);
                return;
            }
            
            // 创建音频源
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffers[actionId];
            
            // 创建增益节点控制音量
            const gainNode = audioContext.createGain();
            
            // 动态调整音量以避免叠加播放时的爆音
            // 计算当前正在播放的同类型音效数量
            const activeSoundCount = getActiveSoundsCount(actionId);
            
            // 根据当前活跃的同类型音效数量调整音量
            // 音效越多，单个音效音量越小，但总音量略有增加感
            const volumeScale = Math.max(0.1, 0.5 / Math.sqrt(activeSoundCount + 1));
            gainNode.gain.value = volumeScale;
            
            // 连接音频节点
            source.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            // 跟踪正在播放的声音
            trackActiveSound(actionId, source, gainNode);
            
            // 播放音频
            source.start(0);
            
            // 当声音播放结束时，从活跃声音列表中移除
            source.onended = () => {
                removeActiveSound(actionId, source);
            };
            
            // 如果需要，更新玩家属性
            if (updateStats) {
                // 记录是否触发了精力代扣
                let energySubstitution = false;
                
                // 应用行动本身的属性影响
                if (ACTION_EFFECTS[actionId]) {
                    const effects = ACTION_EFFECTS[actionId];
                    
                    // 应用每个属性的影响
                    Object.entries(effects).forEach(([stat, value]) => {
                        if (playerStats.hasOwnProperty(stat)) {
                            // 如果是负面影响且当前属性值为0，不再用精力代扣
                            if (value < 0 && playerStats[stat] === 0) {
                                // 不做任何代扣操作
                                
                                // 触发对应属性的闪烁警告效果
                                flashWarning(stat);
                            } else {
                                // 使用新函数更新玩家属性并触发动画
                                updatePlayerStat(stat, playerStats[stat] + value);
                            }
                        }
                    });
                }
                
                // 炒股特殊效果：随机改变金钱（-10%到10%之间）
                if (actionId === '炒股' && playerStats.金钱 > 0) {
                    // 随机生成-10到10之间的数字作为百分比
                    const randomPercent = (Math.random() * 20 - 10) / 100;
                    // 计算金钱变化值（四舍五入到整数）
                    const moneyChange = Math.round(playerStats.金钱 * randomPercent);
                    // 应用变化（使用新函数）
                    updatePlayerStat('金钱', playerStats.金钱 + moneyChange);
                    
                    // 显示炒股结果提示
                    if (moneyChange > 0) {
                        showStockResultMessage(moneyChange, true); // 盈利
                    } else if (moneyChange < 0) {
                        showStockResultMessage(Math.abs(moneyChange), false); // 亏损
                    }
                }
                
                // 更新解锁按钮状态 - 检查是否可以解锁新行动
                updateUnlockButtonState();
            }
        } catch (error) {
            console.error('播放声音错误:', error);
        }
    }
    
    // 跟踪活跃的声音对象
    // 使用全局定义的activeSounds变量，不需要再次声明
    
    // 跟踪正在播放的声音
    function trackActiveSound(actionId, source, gainNode) {
        if (!activeSounds[actionId]) {
            activeSounds[actionId] = [];
        }
        activeSounds[actionId].push({ source, gainNode, startTime: audioContext.currentTime });
        
        // 调整所有活跃声音的音量以保持总音量在合理范围
        adjustActiveSoundsVolume(actionId);
    }
    
    // 从活跃声音列表中移除
    function removeActiveSound(actionId, source) {
        if (activeSounds[actionId]) {
            const index = activeSounds[actionId].findIndex(sound => sound.source === source);
            if (index !== -1) {
                activeSounds[actionId].splice(index, 1);
                
                // 如果没有活跃声音了，清理数组
                if (activeSounds[actionId].length === 0) {
                    delete activeSounds[actionId];
                } else {
                    // 调整剩余声音的音量
                    adjustActiveSoundsVolume(actionId);
                }
            }
        }
    }
    
    // 获取某个行动当前活跃的声音数量
    function getActiveSoundsCount(actionId) {
        return activeSounds[actionId] ? activeSounds[actionId].length : 0;
    }
    
    // 调整所有活跃声音的音量
    function adjustActiveSoundsVolume(actionId) {
        if (!activeSounds[actionId]) return;
        
        const sounds = activeSounds[actionId];
        const count = sounds.length;
        
        // 根据数量调整音量
        sounds.forEach(sound => {
            const elapsedTime = audioContext.currentTime - sound.startTime;
            // 已播放超过50ms的声音不再调整音量，避免听感突变
            if (elapsedTime < 0.05) {
                const volumeScale = Math.max(0.1, 0.5 / Math.sqrt(count));
                sound.gainNode.gain.value = volumeScale;
            }
        });
    }
    
    // 属性闪烁警告效果
    function flashWarning(stat) {
        // 找到对应的属性元素并添加闪烁警告类
        const statElements = document.querySelectorAll('.stat-item');
        for (let i = 0; i < statElements.length; i++) {
            if (statElements[i].textContent.includes(stat)) {
                statElements[i].classList.add('stat-flash-warning');
                
                // 3秒后移除闪烁效果
                setTimeout(() => {
                    statElements[i].classList.remove('stat-flash-warning');
                }, 1500);
                break;
            }
        }
    }
    
    // 播放动画
    function animatePlayhead() {
        if (!isPlaying) return;
        
        try {
            const currentTime = audioContext.currentTime;
            const elapsedTime = currentTime - startTime;
            
            // 计算播放头位置（0到1范围）
            const position = (elapsedTime % ANIMATION_DURATION) / ANIMATION_DURATION;
            
            // 获取节拍区域的宽度 (总宽度减去动作按钮列的宽度)
            const gridRect = gridContainer.getBoundingClientRect();
            const totalWidth = gridRect.width;
            const beatAreaWidth = totalWidth - 90; // 90px是动作按钮列的宽度
            
            // 计算播放头位置
            // 起始位置是90px，然后根据position在节拍区域内移动
            const leftPos = 90 + (position * beatAreaWidth);
            
            // 更新播放头位置 (使用px而不是百分比)
            playhead.style.left = `${leftPos}px`;
            
            // 计算当前列
            const currentColumn = Math.floor(position * GRID_COLUMNS);
            
            // 更新当前列的高亮
            updateCurrentColumn(currentColumn);
            
            // 检查是否需要触发新列的音符
            // 如果当前列与上一次触发的列不同，或者到达循环的终点，则触发新列的音符
            if (currentColumn !== lastTriggeredColumn) {
                // 使用 requestAnimationFrame 确保更新视觉和播放音效保持同步
                window.requestAnimationFrame(() => {
                    // 触发当前列的音符
                    triggerColumnNotes(currentColumn);
                
                    // 更新最后触发的列
                    lastTriggeredColumn = currentColumn;
                });
            }
            
            // 检查是否完成一次循环（一天）
            // 通过判断currentTime与lastCycleTime的差值是否接近一个完整循环的时间来确定是否应该增加计数
            if (position < 0.05 && currentTime - lastCycleTime >= ANIMATION_DURATION * 0.9) {
                // 增加天数计数
                playCounter++;
                playCount.textContent = playCounter;
                
                // 更新上次循环计数时间
                lastCycleTime = currentTime;
                
                // 每天结算：扣除等同于欲望值的金钱
                if (playerStats.欲望 > 0) {
                    // 使用新函数更新金钱值并触发动画
                    updatePlayerStat('金钱', playerStats.金钱 - playerStats.欲望);
                    
                    // 显示欲望消费提示
                    showDesireConsumptionMessage(playerStats.欲望);
                    
                    // 消费后将欲望清零（使用新函数）
                    const consumedDesire = playerStats.欲望;
                    updatePlayerStat('欲望', 0);
                    
                    // 检查金钱是否小于等于0
                    if (playerStats.金钱 < 0) {
                        playerStats.金钱 = 0; // 确保金钱不会显示为负数
                        updateStatsDisplay(); // 这里需要再次更新显示
                        stopPlayback();
                        showGameOverMessage("你破产了！欲望消耗了你所有的财富。");
                        return;
                    }
                }
                
                updateStatsDisplay();
                
                // 检查是否达到播放上限
                if (playCounter >= PLAY_LIMIT) {
                    stopPlayback();
                    // 游戏正常完成，只显示结算界面
                    showSettlementScreen(false);
                    return;
                }
                
                // 检查是否需要显示结算界面
                // if (checkSettlementCondition()) {
                //     stopPlayback();
                //     showSettlementScreen(false);
                //     return;
                // }
            }
        } catch (error) {
            console.error('动画播放头错误:', error);
            stopPlayback();
            return;
        }
        
        // 使用 requestAnimationFrame 确保更平滑的动画
        if (isPlaying) {
            animationId = requestAnimationFrame(animatePlayhead);
        }
    }
    
    // 触发指定列的所有音符
    function triggerColumnNotes(column) {
        // 找到这一列所有激活的音符
        const activeCells = document.querySelectorAll(`.grid-cell[data-column="${column}"].active`);
        
        // 只有当有激活的格子时才播放背景节奏
        if (activeCells.length > 0) {
            try {
                // 检查是否需要创建新的背景节奏增益节点
                if (!backgroundRhythmGain) {
                    backgroundRhythmGain = audioContext.createGain();
                    backgroundRhythmGain.gain.value = 0.15; // 设置较低的音量
                    backgroundRhythmGain.connect(audioContext.destination);
                }
                
                // 重新创建背景节奏源（因为每次播放完后不能重用）
                if (!backgroundRhythmSource || !backgroundRhythmSource.isPlaying) {
                    // 如果之前有音源在播放，尝试停止它
                    if (backgroundRhythmSource) {
                        try {
                            backgroundRhythmSource.stop();
                        } catch (e) {
                            // 忽略已经停止的错误
                        }
                    }
                    
                    backgroundRhythmSource = audioContext.createBufferSource();
                    backgroundRhythmSource.buffer = audioBuffers['base_rhythm'];
                    backgroundRhythmSource.loop = false;
                    backgroundRhythmSource.connect(backgroundRhythmGain);
                    
                    // 标记为正在播放
                    backgroundRhythmSource.isPlaying = true;
                    
                    // 播放背景节奏
                    backgroundRhythmSource.start(0);
                    
                    // 监听播放结束事件
                    backgroundRhythmSource.onended = function() {
                        backgroundRhythmSource.isPlaying = false;
                    };
                }
            } catch (error) {
                console.error('播放背景节奏错误:', error);
            }
        }

        // 触发每个激活的音符，立即更新属性和视觉效果
        activeCells.forEach(cell => {
            const actionId = cell.getAttribute('data-action');
            if (actionId && noteData[actionId] && noteData[actionId][column]) {
                // 更新该行动的触发次数
                if (!actionTriggerCounts[actionId]) {
                    actionTriggerCounts[actionId] = 0;
                }
                actionTriggerCounts[actionId]++;
                
                // 触发声音和属性更新
                playSound(actionId, true);
                
                // 添加一个视觉反馈效果
                cell.style.animation = 'none';
                setTimeout(() => {
                    cell.style.animation = 'pulse 0.3s ease-in-out';
                }, 10);
            }
        });
    }
    
    // 更新当前列的高亮
    function updateCurrentColumn(currentColumn) {
        // 移除所有当前列标记
        document.querySelectorAll('.grid-cell.current').forEach(cell => {
            cell.classList.remove('current');
        });
        
        // 添加当前列标记
        document.querySelectorAll(`.grid-cell[data-column="${currentColumn}"]`).forEach(cell => {
            cell.classList.add('current');
        });
    }
    
    // 重置播放计数和玩家属性
    function resetPlayCount() {
        // 重置天数计数
        playCounter = 0;
        playCount.textContent = playCounter;
        lastCycleTime = audioContext?.currentTime || Date.now() / 1000; // 重置上次循环计数时间
        lastTriggeredColumn = -1; // 重置最后触发的列
        
        // 重置玩家属性
        Object.keys(playerStats).forEach(stat => {
            let newValue;
            // 效率重置为1，耐心重置为3，其他重置为0
            if (stat === '效率') {
                newValue = 1;
            } else if (stat === '耐心') {
                newValue = 3;
            } else {
                newValue = 0;
            }
            
            // 使用新函数更新属性值
            updatePlayerStat(stat, newValue);
        });
        
        // 清空所有音符
        Object.keys(noteData).forEach(action => {
            noteData[action] = {};
        });
        
        // 重置行动列表到初始状态（只保留工作、吃饭、刷手机）
        addedActions.length = 0;
        addedActions.push({ id: '工作', name: '工作' });
        addedActions.push({ id: '吃饭', name: '吃饭' });
        addedActions.push({ id: '刷手机', name: '刷手机' });
        
        // 重新初始化按钮
        initTrackButtons();
        
        // 重新初始化网格
        initGrid();
        
        // 重新设置预设音符
        initPresetNotes();
        
        // 更新所有行动按钮样式
        updateAllActionButtonStyles();
        
        // 更新解锁按钮状态
        updateUnlockButtonState();
        
        // 重置行动触发次数
        Object.keys(actionTriggerCounts).forEach(key => {
            actionTriggerCounts[key] = 0;
        });
    }
    
    // 更新行动按钮样式
    function updateActionButtonStyle(button, actionId) {
        // 移除现有样式类
        button.classList.remove('energy-positive', 'energy-negative', 'energy-neutral');
    }
    
    // 更新所有行动按钮样式
    function updateAllActionButtonStyles() {
        // 使用gridContainer而不是trackList
        const actionButtons = gridContainer.querySelectorAll('.track-button:not(#addTrackButtonInGrid)');
        actionButtons.forEach((button, index) => {
            if (index < addedActions.length) {
                updateActionButtonStyle(button, addedActions[index].id);
            }
        });
    }
    
    // 初始化轨道按钮 - 现在只是一个空函数，因为按钮在initGrid中创建
    function initTrackButtons() {
        // 不需要做任何事情，按钮已经在initGrid中创建
        console.log("轨道按钮已在initGrid中创建");
    }
    
    // 添加新行动
    function addAction(actionId) {
        // 添加到已添加行动列表
        const newAction = { id: actionId, name: actionId };
        addedActions.push(newAction);
        
        // 检查解锁是否需要提升效率和耐心
        let efficiencyIncreased = false;
        let patienceIncreased = false;
        let newEfficiency = playerStats.效率;
        let newPatience = playerStats.耐心;
        
        // 检查是否需要增加效率
        if (shouldIncreaseEfficiency(addedActions.length)) {
            updatePlayerStat('效率', playerStats.效率 + 1);
            newEfficiency = playerStats.效率;
            efficiencyIncreased = true;
        }
        
        // 检查是否需要增加耐心
        if (shouldIncreasePatience(addedActions.length)) {
            updatePlayerStat('耐心', playerStats.耐心 + 1);
            newPatience = playerStats.耐心;
            patienceIncreased = true;
        }
        
        // 添加新的行动按钮
        const newButton = document.createElement('button');
        newButton.className = 'track-button';
        
        // 创建标题行（包含emoji和名称）
        const actionHeader = document.createElement('div');
        actionHeader.className = 'action-header';
        
        // 创建emoji容器
        const emojiSpan = document.createElement('span');
        emojiSpan.className = 'action-emoji';
        emojiSpan.textContent = ACTION_EMOJIS[actionId] || '';
        actionHeader.appendChild(emojiSpan);
        
        // 创建行动名称
        const nameSpan = document.createElement('span');
        nameSpan.className = 'action-name';
        nameSpan.textContent = actionId;
        actionHeader.appendChild(nameSpan);
        
        // 添加标题行到按钮
        newButton.appendChild(actionHeader);
        
        // 创建效果容器
        const effectSpan = document.createElement('div');
        effectSpan.className = 'action-effect';
        
        // 添加属性效果图标
        if (ACTION_EFFECTS[actionId]) {
            Object.entries(ACTION_EFFECTS[actionId]).forEach(([stat, value]) => {
                // 创建效果图标
                const effectIconSpan = document.createElement('span');
                effectIconSpan.className = 'effect-icon';
                
                // 根据属性类型选择图标
                let icon = '';
                if (stat === '金钱') icon = '💰';
                else if (stat === '见闻') icon = '📚';
                else if (stat === '欲望') icon = '🔥';
                
                // 添加+/-符号
                if (value > 0) {
                    effectIconSpan.className += ' positive-effect';
                    effectIconSpan.textContent = `${icon}+`;
                } else {
                    effectIconSpan.className += ' negative-effect';
                    effectIconSpan.textContent = `${icon}-`;
                }
                
                effectSpan.appendChild(effectIconSpan);
            });
        }
        
        // 添加效果容器到按钮
        newButton.appendChild(effectSpan);
        
        // 设置行动按钮样式
        updateActionButtonStyle(newButton, actionId);
        
        // 初始化该行动的音符数据
        noteData[actionId] = {};
        
        // 重新初始化网格
        initGrid();
        
        // 更新解锁按钮状态
        updateUnlockButtonState();
        
        // 显示整合的解锁提示（包括效率和耐心提升）
        showUnlockMessage(actionId, efficiencyIncreased, newEfficiency, patienceIncreased, newPatience);
    }
    
    // 获取下一个可解锁的行动
    function getNextUnlockableAction() {
        // 获取当前已添加的行动ID列表
        const addedActionIds = addedActions.map(action => action.id);
        
        // 获取未添加的行动
        const availableActions = ACTION_TYPES.filter(action => !addedActionIds.includes(action));
        
        if (availableActions.length === 0) {
            return null; // 没有可解锁的行动了
        }
        
        // 从未添加的行动中随机选择一个
        const randomIndex = Math.floor(Math.random() * availableActions.length);
        return availableActions[randomIndex];
    }
    
    // 获取下一个行动解锁需要的见闻值
    function getNextUnlockRequirement() {
        // 基于已解锁的行动数量计算下一次解锁需要的见闻值
        return calculateKnowledgeRequirement(addedActions.length);
    }
    
    // 更新解锁按钮状态
    function updateUnlockButtonState() {
        // 检查addTrackButton是否存在
        if (!addTrackButton) {
            console.log('解锁按钮未初始化，跳过状态更新');
            return;
        }
        
        // 检查是否还有可解锁的行动
        const hasUnlockableActions = ACTION_TYPES.length > addedActions.length;
        
        if (!hasUnlockableActions) {
            // 没有可解锁的行动了
            addTrackButton.textContent = "已全部解锁";
            addTrackButton.disabled = true;
            addTrackButton.classList.add('disabled');
            addTrackButton.classList.remove('unlockable');
            return;
        }
        
        // 计算当前解锁需要的见闻值
        const requiredKnowledge = getNextUnlockRequirement();
        const currentKnowledge = playerStats.见闻;
        
        // 如果达到解锁条件，自动解锁新行动
        if (currentKnowledge >= requiredKnowledge) {
            // 获取下一个可解锁的行动
            const nextAction = getNextUnlockableAction();
            if (nextAction) {
                // 自动解锁新行动
                console.log(`见闻值达到要求(${requiredKnowledge})，自动解锁新行动: ${nextAction}`);
                addAction(nextAction);
                
                // 不再消耗见闻值
                // updatePlayerStat('见闻', currentKnowledge - requiredKnowledge);
                
                // 更新显示
                updateStatsDisplay();
                
                // 递归调用以检查是否可以解锁更多行动
                updateUnlockButtonState();
                return;
            }
            
            // 如果没有找到可解锁的行动但仍有可解锁的空间（不应该发生）
            addTrackButton.textContent = "领悟新行动";
            addTrackButton.disabled = false;
            addTrackButton.classList.remove('disabled');
            addTrackButton.classList.add('unlockable');
        } else {
            // 未满足解锁条件，但仍然显示为可点击按钮（只需要达到见闻值要求）
            addTrackButton.textContent = `领悟新行动`;
            
            // 检查是否达到见闻值要求
            if (currentKnowledge >= requiredKnowledge) {
                addTrackButton.disabled = false;
                addTrackButton.classList.remove('disabled');
                addTrackButton.classList.add('unlockable');
            } else {
                addTrackButton.textContent = `需要见闻${requiredKnowledge}`;
                addTrackButton.disabled = true;
                addTrackButton.classList.add('disabled');
                addTrackButton.classList.remove('unlockable');
            }
        }
    }
    
    // 显示欲望消费提示信息（放在界面顶部居中位置）
    function showDesireConsumptionMessage(amount) {
        // 先删除可能存在的旧消息
        const oldMessages = document.querySelectorAll('.desire-consumption-message');
        oldMessages.forEach(msg => {
            if (msg.parentNode) {
                msg.parentNode.removeChild(msg);
            }
        });
        
        // 创建消息元素
        const message = document.createElement('div');
        message.className = 'desire-consumption-message';
        message.innerHTML = `你冲动消费了${amount}金钱`;
        
        // 设置样式为明显可见的文本 - 置于顶部居中
        message.style.display = 'inline-block';
        message.style.color = '#ff5252';
        message.style.backgroundColor = 'rgba(255, 82, 82, 0.1)';
        message.style.border = '1px solid #ff5252';
        message.style.borderRadius = '3px';
        message.style.fontSize = '14px';
        message.style.fontWeight = 'bold';
        message.style.padding = '4px 10px';
        message.style.position = 'fixed';
        message.style.top = '8px';
        message.style.left = '50%';
        message.style.transform = 'translateX(-50%)';
        message.style.zIndex = '1000';
        message.style.boxShadow = '0 2px 8px rgba(255, 82, 82, 0.3)';
        
        // 添加到页面
        document.body.appendChild(message);
        
        // 3秒后移除消息
        setTimeout(() => {
            if (message.parentNode) {
                message.parentNode.removeChild(message);
            }
        }, 3000);
    }
    
    // 添加失败信息和鼓励的话
    const gameOverMessages = {
        '破产': {
            title: '你破产了...',
            musician: 'Dr.Odd',
            quote: '当你凝视欲望时，它并不会把钱还给你。'
        },
        '时间': {
            title: '游戏结束：60天已完成',
            musician: '系统',
            quote: '你已经完成了60天的生活律动，希望你找到了自己的节奏。期待你的下一次演奏！'
        },
        '过劳': {
            title: '过度工作导致精力耗尽',
            musician: '系统',
            quote: '工作固然重要，但别忘了生活的平衡。下次尝试给自己留些休息的时间吧。'
        },
        '无所事事': {
            title: '缺乏行动导致生活停滞',
            musician: '系统',
            quote: '没有行动的生活如同静止的音乐，尝试多做些事情，为生活增添节奏和活力。'
        }
    };
    
    // 显示结算界面
    function showSettlementScreen(isGameOver = false, gameOverType = '') {
        // 获取结算标题元素
        const settlementTitle = document.querySelector('.settlement-title');
        const musicTitleLabel = document.querySelector('.music-title-label');
        const continueButton = document.getElementById('continueButton');
        
        // 添加或移除游戏结束样式
        if (isGameOver) {
            settlementScreen.classList.add('game-over');
        } else {
            settlementScreen.classList.remove('game-over');
        }
        
        if (isGameOver) {
            // 游戏结束情况
            // 获取对应的游戏结束信息
            const gameOverInfo = gameOverMessages[gameOverType] || gameOverMessages['时间'];
            
            // 修改标题显示
            settlementTitle.textContent = '游戏结束';
            musicTitleLabel.textContent = '';
            
            // 更新结算界面内容为游戏结束信息
            document.getElementById('musicTitle').textContent = gameOverInfo.title;
            document.getElementById('musicianQuote').textContent = gameOverInfo.quote;
            document.getElementById('musicianName').textContent = gameOverInfo.musician;
            
            // 移除乐谱视图（如果有）
            const existingRhythmView = document.querySelector('.rhythm-view-container');
            if (existingRhythmView) {
                existingRhythmView.remove();
            }
            
            // 修改继续按钮文本
            continueButton.textContent = '重新开始';
            
            // 添加按钮点击事件
            continueButton.onclick = () => {
                // 重置游戏
                resetPlayCount();
                
                // 清空行动触发次数
                Object.keys(actionTriggerCounts).forEach(key => {
                    actionTriggerCounts[key] = 0;
                });
                
                // 隐藏结算界面
                settlementScreen.style.display = 'none';
                
                // 显示游戏界面
                gameContainer.style.display = 'flex';
                
                // 重新开始播放
                startPlayback();
            };
        } else {
            // 正常结算情况
            // 恢复正常标题
            settlementTitle.textContent = '幕间休整';
            musicTitleLabel.textContent = '你的生活乐章';
            
            // 获取触发次数最多的行动
            const mostTriggeredAction = getMostTriggeredAction();
            
            // 获取对应的音乐信息
            const musicInfo = musicTitles[mostTriggeredAction] || defaultMusicInfo;
            
            // 更新结算界面内容
            document.getElementById('musicTitle').textContent = musicInfo.title;
            
            // 创建并添加节拍图形视图
            createRhythmView();
            
            document.getElementById('musicianQuote').textContent = musicInfo.quote;
            document.getElementById('musicianName').textContent = musicInfo.musician;
            
            // 根据是否达到游戏天数上限修改按钮文本和功能
            if (playCounter >= PLAY_LIMIT) {
                // 游戏已完成60天，显示重新开始按钮
                continueButton.textContent = '重新开始';
                
                // 设置按钮点击事件为重置游戏
                continueButton.onclick = () => {
                    // 重置游戏
                    resetPlayCount();
                    
                    // 清空行动触发次数
                    Object.keys(actionTriggerCounts).forEach(key => {
                        actionTriggerCounts[key] = 0;
                    });
                    
                    // 隐藏结算界面
                    settlementScreen.style.display = 'none';
                    
                    // 显示游戏界面
                    gameContainer.style.display = 'flex';
                    
                    // 重新开始播放
                    startPlayback();
                };
            } else {
                // 游戏未结束，显示继续演奏按钮
                continueButton.textContent = '继续演奏';
                
                // 设置按钮点击事件为继续游戏
                continueButton.onclick = () => {
                    // 隐藏结算界面
                    settlementScreen.style.display = 'none';
                    
                    // 显示游戏界面
                    gameContainer.style.display = 'flex';
                    
                    // 继续播放
                    startPlayback();
                };
            }
        }
        
        // 显示结算界面
        settlementScreen.style.display = 'flex';
        
        // 隐藏游戏界面
        gameContainer.style.display = 'none';
    }
    
    // 创建节拍图形视图
    function createRhythmView() {
        // 移除现有的节拍视图（如果有）
        const existingRhythmView = document.querySelector('.rhythm-view-container');
        if (existingRhythmView) {
            existingRhythmView.remove();
        }
        
        // 创建容器
        const rhythmViewContainer = document.createElement('div');
        rhythmViewContainer.className = 'rhythm-view-container';
        
        // 创建标题
        const rhythmViewTitle = document.createElement('h3');
        rhythmViewTitle.className = 'rhythm-view-title';
        rhythmViewTitle.textContent = '你的生活乐谱';
        rhythmViewContainer.appendChild(rhythmViewTitle);
        
        // 创建节拍网格容器
        const rhythmGrid = document.createElement('div');
        rhythmGrid.className = 'rhythm-grid';
        
        // 获取所有被添加的行动
        const activeActions = addedActions.filter(action => {
            // 检查这个行动是否有至少一个激活的节拍
            return Object.keys(noteData[action.id] || {}).length > 0;
        });
        
        // 为每个有节拍的行动创建一行
        activeActions.forEach(action => {
            const actionId = action.id;
            const actionNotes = noteData[actionId] || {};
            
            // 只为有节拍的行动创建行
            if (Object.keys(actionNotes).length > 0) {
                // 创建行容器
                const rowContainer = document.createElement('div');
                rowContainer.className = 'rhythm-row';
                
                // 行动名称
                const actionLabel = document.createElement('div');
                actionLabel.className = 'rhythm-action-label';
                actionLabel.innerHTML = `${ACTION_EMOJIS[actionId] || ''} ${actionId}`;
                rowContainer.appendChild(actionLabel);
                
                // 节拍容器
                const beatsContainer = document.createElement('div');
                beatsContainer.className = 'rhythm-beats-container';
                
                // 创建8列节拍格
                for (let i = 0; i < GRID_COLUMNS; i++) {
                    const beat = document.createElement('div');
                    beat.className = 'rhythm-beat';
                    
                    // 如果这个节拍被激活，添加激活样式
                    if (actionNotes[i]) {
                        beat.classList.add('active');
                        beat.innerHTML = ACTION_EMOJIS[actionId] || '';
                    }
                    
                    beatsContainer.appendChild(beat);
                }
                
                rowContainer.appendChild(beatsContainer);
                rhythmGrid.appendChild(rowContainer);
            }
        });
        
        // 如果没有行动有节拍，显示提示信息
        if (activeActions.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'rhythm-empty-message';
            emptyMessage.textContent = '你的生活乐章还是一片空白';
            rhythmGrid.appendChild(emptyMessage);
        }
        
        rhythmViewContainer.appendChild(rhythmGrid);
        
        // 找到结算面板中的引用点，并插入节拍视图
        const musicTitle = document.getElementById('musicTitle');
        const quoteContainer = document.querySelector('.quote-container');
        
        if (musicTitle && quoteContainer) {
            // 获取父容器
            const settlementContent = document.querySelector('.settlement-content');
            // 在曲目标题和音乐家点评之间插入
            settlementContent.insertBefore(rhythmViewContainer, quoteContainer);
        }
    }
    
    // 显示游戏结束信息
    function showGameOverMessage(message) {
        // 根据消息内容判断游戏结束类型
        let gameOverType = '时间';
        
        if (message.includes('破产') || message.includes('欲望消耗') || message.includes('金钱为0')) {
            gameOverType = '破产';
        } else if (message.includes('工作过度') || message.includes('过度工作')) {
            gameOverType = '过劳';
        } else if (message.includes('无所事事') || message.includes('行动太少')) {
            gameOverType = '无所事事';
        }
        
        // 显示整合的结算界面，传入游戏结束标志和类型
        showSettlementScreen(true, gameOverType);
    }
    
    // 显示解锁提示信息（整合效率和耐心提升消息）
    function showUnlockMessage(actionName, efficiencyIncreased, newEfficiency, patienceIncreased, newPatience) {
        // 移除所有现有的解锁消息，避免叠加
        const existingMessages = document.querySelectorAll('.unlock-message');
        existingMessages.forEach(msg => {
            document.body.removeChild(msg);
        });
        
        let messageHTML = `<div>新行动!</div><div class="unlocked-action-name">${ACTION_EMOJIS[actionName] || ''} ${actionName}</div>`;
        
        // 添加效率提升信息
        if (efficiencyIncreased) {
            messageHTML += `<div class="unlock-bonus">效率提升至 ${newEfficiency}！</div>`;
        }
        
        // 添加耐心提升信息
        if (patienceIncreased) {
            messageHTML += `<div class="unlock-bonus">耐心提升至 ${newPatience}！</div>`;
        }
        
        const message = document.createElement('div');
        message.className = 'unlock-message';
        message.innerHTML = messageHTML;
        message.style.position = 'fixed';
        message.style.top = '50%';
        message.style.left = '50%';
        message.style.transform = 'translate(-50%, -50%)';
        message.style.backgroundColor = 'rgba(33, 150, 243, 0.9)';
        message.style.color = 'white';
        message.style.padding = '15px 25px';
        message.style.borderRadius = '10px';
        message.style.fontWeight = 'bold';
        message.style.zIndex = '999';
        message.style.opacity = '0';
        message.style.transition = 'opacity 0.5s ease';
        message.style.textAlign = 'center';
        message.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.3)';
        
        document.body.appendChild(message);
        
        // 显示消息
        setTimeout(() => {
            message.style.opacity = '1';
        }, 10);
        
        // 3秒后移除消息
        setTimeout(() => {
            message.style.opacity = '0';
            setTimeout(() => {
                document.body.removeChild(message);
            }, 500);
        }, 4000); // 延长显示时间以便阅读效率和耐心信息
    }
    
    // 显示效率限制提示信息
    function showEfficiencyLimitMessage(column, efficiency) {
        const message = document.createElement('div');
        message.className = 'efficiency-limit-message';
        message.innerHTML = `效率不够：每列最多${efficiency}个行动`;
        message.style.position = 'fixed';
        message.style.top = '50%';
        message.style.left = '50%';
        message.style.transform = 'translate(-50%, -50%)';
        message.style.backgroundColor = 'rgba(33, 150, 243, 0.9)';
        message.style.color = 'white';
        message.style.padding = '10px 20px';
        message.style.borderRadius = '5px';
        message.style.fontWeight = 'bold';
        message.style.zIndex = '999';
        message.style.opacity = '0';
        message.style.transition = 'opacity 0.5s ease';
        
        document.body.appendChild(message);
        
        // 高亮显示当前列
        const columnCells = document.querySelectorAll(`.grid-cell[data-column="${column}"]`);
        columnCells.forEach(cell => {
            cell.classList.add('efficiency-limit-highlight');
            setTimeout(() => {
                cell.classList.remove('efficiency-limit-highlight');
            }, 1500);
        });
        
        // 显示消息
        setTimeout(() => {
            message.style.opacity = '1';
        }, 10);
        
        // 1.5秒后移除消息
        setTimeout(() => {
            message.style.opacity = '0';
            setTimeout(() => {
                document.body.removeChild(message);
            }, 500);
        }, 1500);
    }
    
    // 显示耐心限制提示信息
    function showPatienceLimitMessage(action, patience) {
        const message = document.createElement('div');
        message.className = 'patience-limit-message';
        message.innerHTML = `耐心不够：每行最多连续${patience}个行动`;
        message.style.position = 'fixed';
        message.style.top = '50%';
        message.style.left = '50%';
        message.style.transform = 'translate(-50%, -50%)';
        message.style.backgroundColor = 'rgba(255, 152, 0, 0.9)';
        message.style.color = 'white';
        message.style.padding = '10px 20px';
        message.style.borderRadius = '5px';
        message.style.fontWeight = 'bold';
        message.style.zIndex = '999';
        message.style.opacity = '0';
        message.style.transition = 'opacity 0.5s ease';
        
        document.body.appendChild(message);
        
        // 高亮显示当前行动的所有单元格
        const rowCells = document.querySelectorAll(`.grid-cell[data-action="${action}"]`);
        rowCells.forEach(cell => {
            cell.classList.add('patience-limit-highlight');
            setTimeout(() => {
                cell.classList.remove('patience-limit-highlight');
            }, 1500);
        });
        
        // 显示消息
        setTimeout(() => {
            message.style.opacity = '1';
        }, 10);
        
        // 1.5秒后移除消息
        setTimeout(() => {
            message.style.opacity = '0';
            setTimeout(() => {
                document.body.removeChild(message);
            }, 500);
        }, 1500);
    }
    
    // 显示炒股结果消息
    function showStockResultMessage(amount, isProfit) {
        // 先删除可能存在的旧消息
        const oldMessages = document.querySelectorAll('.stock-result-message');
        oldMessages.forEach(msg => {
            if (msg.parentNode) {
                msg.parentNode.removeChild(msg);
            }
        });
        
        const message = document.createElement('div');
        message.className = 'stock-result-message';
        
        if (isProfit) {
            message.innerHTML = `炒股盈利：+${amount}金钱 📈`;
            message.style.backgroundColor = 'rgba(76, 175, 80, 0.9)'; // 绿色背景表示盈利
        } else {
            message.innerHTML = `炒股亏损：-${amount}金钱 📉`;
            message.style.backgroundColor = 'rgba(244, 67, 54, 0.9)'; // 红色背景表示亏损
        }
        
        // 设置位置在屏幕中央偏上方，比解锁消息更高
        message.style.position = 'fixed';
        message.style.top = '30%'; // 设为30%，比解锁消息(50%)更靠上
        message.style.left = '50%';
        message.style.transform = 'translate(-50%, -50%)';
        
        // 样式设置
        message.style.color = 'white';
        message.style.padding = '10px 20px';
        message.style.borderRadius = '5px';
        message.style.fontWeight = 'bold';
        message.style.zIndex = '998'; // 设置为998，比解锁消息(999)低一级
        message.style.opacity = '0';
        message.style.transition = 'opacity 0.5s ease';
        message.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.3)';
        message.style.textAlign = 'center';
        
        document.body.appendChild(message);
        
        // 显示消息
        setTimeout(() => {
            message.style.opacity = '1';
        }, 10);
        
        // 2秒后移除消息
        setTimeout(() => {
            message.style.opacity = '0';
            setTimeout(() => {
                if (message.parentNode) {
                    message.parentNode.removeChild(message);
                }
            }, 500);
        }, 2000);
    }
    
    // 重构顶部布局
    function restructureHeader() {
        try {
            console.log('开始重构顶部布局');
            const header = document.querySelector('.header');
            
            if (!header) {
                console.error('无法找到header元素，中止重构');
                window.debugLog && window.debugLog('重构失败：无法找到header元素');
                return false;
            }
            
            // 保存原始内容作为备份
            const originalContent = header.innerHTML;
            
            try {
                // 清空现有内容
                header.innerHTML = '';
                
                // ======= 第一行：控制元素和二级属性 =======
                const headerTopRow = document.createElement('div');
                headerTopRow.className = 'header-top-row';
                
                // 左侧区域：只保留天数计数
                const leftControls = document.createElement('div');
                leftControls.className = 'left-controls';
                
                // 天数计数器
                const counter = document.createElement('div');
                counter.className = 'counter';
                counter.innerHTML = `天数: <span id="playCount">0</span>/<span id="playLimit">${PLAY_LIMIT}</span>`;
                leftControls.appendChild(counter);
                
                // 添加到顶部行
                headerTopRow.appendChild(leftControls);
                
                // 右侧区域：效率、耐心属性
                const rightControls = document.createElement('div');
                rightControls.className = 'right-controls';
                
                // 效率属性
                const efficiencyItem = document.createElement('div');
                efficiencyItem.className = 'secondary-stat';
                efficiencyItem.title = '效率决定了每个节拍可激活的最大行动数量';
                efficiencyItem.innerHTML = `效率: <span>${playerStats.效率}</span>`;
                rightControls.appendChild(efficiencyItem);
                
                // 耐心属性
                const patienceItem = document.createElement('div');
                patienceItem.className = 'secondary-stat';
                patienceItem.title = '耐心决定了一个行动可以连续激活的最大数量';
                patienceItem.innerHTML = `耐心: <span>${playerStats.耐心}</span>`;
                rightControls.appendChild(patienceItem);
                
                // 添加到顶部行
                headerTopRow.appendChild(rightControls);
                
                // 添加第一行到header
                header.appendChild(headerTopRow);
                
                // ======= 第二行：主要属性（金钱、见闻、欲望）=======
                const headerBottomRow = document.createElement('div');
                headerBottomRow.className = 'header-bottom-row';
                
                // 主属性容器
                const statsDiv = document.createElement('div');
                statsDiv.id = 'statsContainer';
                statsDiv.className = 'main-stats-container';
                
                // 添加到底部行
                headerBottomRow.appendChild(statsDiv);
                
                // 添加第二行到header
                header.appendChild(headerBottomRow);
            } catch (innerError) {
                console.error('重构顶部布局内部错误，恢复原始内容:', innerError);
                // 恢复原始内容
                header.innerHTML = originalContent;
                window.debugLog && window.debugLog('重构内部错误: ' + innerError.message);
                return false;
            }
            
            console.log('顶部布局重构完成');
            
            // 验证元素是否都被正确创建
            const criticalElements = [
                document.getElementById('playCount'),
                document.getElementById('playLimit'),
                document.getElementById('statsContainer')
            ];
            
            if (criticalElements.some(el => !el)) {
                console.error('重要元素创建失败，恢复原始内容');
                header.innerHTML = originalContent;
                window.debugLog && window.debugLog('重构失败：某些元素无法创建');
                return false;
            }
            
            return true; // 重构成功
        } catch (error) {
            console.error('重构顶部布局时发生错误:', error);
            if (window.debugLog) {
                window.debugLog('重构顶部布局错误: ' + error.message);
            }
            return false;
        }
    }
    
    // 初始化
    function initialize() {
        try {
            console.log("开始游戏初始化...");
            window.debugLog && window.debugLog("开始游戏初始化...");
            
            // 重构顶部布局
            console.log("开始重构顶部布局");
            restructureHeader();
            console.log("顶部布局重构完成");
            
            // 设置延迟获取DOM元素，确保布局重构后的元素都已经准备好
            console.log("延迟执行DOM元素获取...");
            setTimeout(() => {
                // 重新获取DOM元素
                getDOMElements();
                console.log("DOM元素获取成功，继续初始化...");
                
                // 初始化游戏网格
                initGrid();
                
                // 更新二级属性值
                updateSecondaryStats();
                
                // 注册按钮点击事件
                setupEventListeners();
                
                // 更新所有行动按钮样式
                updateAllActionButtonStyles();
                
                // 初始化预设音符
                initPresetNotes();
                
                // 显示游戏界面
                gameContainer.style.opacity = "1";
                
                console.log("游戏初始化完成");
            }, 50);
            
            // 防止iOS上的音频问题
            document.addEventListener('touchstart', () => {
                if (audioContext && audioContext.state === 'suspended') {
                    audioContext.resume();
                }
            });
        } catch (error) {
            console.error("初始化过程中发生错误:", error);
            window.debugLog && window.debugLog(`初始化错误: ${error.message}`);
        }
    }
    
    // 设置事件监听器
    function setupEventListeners() {
        // 监听窗口大小变化
        window.addEventListener('resize', () => {
            // 可以在这里添加响应式调整的代码
        });
        
        // 监听设备方向变化（移动设备）
        window.addEventListener('orientationchange', () => {
            // 可以在这里添加设备方向变化的处理代码
        });
        
        // 为解锁按钮添加点击事件，先检查按钮是否存在
        const unlockButton = document.getElementById('unlockButton');
        if (unlockButton) {
            unlockButton.addEventListener('click', () => {
                const action = getNextUnlockableAction();
                if (action) {
                    // 使用addAction替代未定义的unlockNewAction
                    addAction(action);
                    
                    // 不再消耗见闻值
                    // const requiredKnowledge = getNextUnlockRequirement();
                    // updatePlayerStat('见闻', playerStats.见闻 - requiredKnowledge);
                    
                    // 更新显示
                    updateStatsDisplay();
                    
                    // 更新解锁按钮状态
                    updateUnlockButtonState();
                }
            });
            
            // 更新解锁按钮状态
            updateUnlockButtonState();
        } else {
            console.log('解锁按钮未找到，跳过事件监听器设置');
        }
        
        // 更新属性显示
        updateStatsDisplay();
    }
    
    // 修改开始游戏函数，加入自动开始播放
    function startGame() {
        // 隐藏开始界面
        startScreen.style.display = 'none';
        
        // 显示游戏容器
        gameContainer.style.display = 'block';
        
        // 初始化游戏
        initialize();
        
        // 添加短暂延迟确保初始化完成
        setTimeout(() => {
            // 自动开始播放
            startPlayback();
        }, 300);
    }
    
    // 初始化预设音符
    function initPresetNotes() {
        // 工作行动音符 - 适应8列布局
        const workColumns = [1, 2, 4, 5];
        workColumns.forEach(col => {
            noteData['工作'][col] = true;
            // 更新UI
            const cell = document.querySelector(`.grid-cell[data-action="工作"][data-column="${col}"]`);
            if (cell) {
                cell.classList.add('active');
                
                // 添加emoji
                const emojiSpan = document.createElement('span');
                emojiSpan.className = 'action-emoji-cell';
                emojiSpan.textContent = ACTION_EMOJIS['工作'] || '';
                cell.innerHTML = '';
                cell.appendChild(emojiSpan);
            }
        });
        
        // 吃饭行动音符 - 适应8列布局
        const eatColumns = [3, 6];
        eatColumns.forEach(col => {
            noteData['吃饭'][col] = true;
            // 更新UI
            const cell = document.querySelector(`.grid-cell[data-action="吃饭"][data-column="${col}"]`);
            if (cell) {
                cell.classList.add('active');
                
                // 添加emoji
                const emojiSpan = document.createElement('span');
                emojiSpan.className = 'action-emoji-cell';
                emojiSpan.textContent = ACTION_EMOJIS['吃饭'] || '';
                cell.innerHTML = '';
                cell.appendChild(emojiSpan);
            }
        });
        // 刷手机行动音符 - 适应8列布局
        const phoneColumns = [0,7];
        phoneColumns.forEach(col => {
            noteData['刷手机'][col] = true;
            // 更新UI
            const cell = document.querySelector(`.grid-cell[data-action="刷手机"][data-column="${col}"]`);  
            if (cell) {
                cell.classList.add('active');
                
                // 添加emoji
                const emojiSpan = document.createElement('span');
                emojiSpan.className = 'action-emoji-cell';  
                emojiSpan.textContent = ACTION_EMOJIS['刷手机'] || '';
                cell.innerHTML = '';
                cell.appendChild(emojiSpan);
            }
        });
        
    }
    
    // 检查是否需要增加效率
    function shouldIncreaseEfficiency(actionCount) {
        // 注意：actionCount是当前行动数，而我们关心的是解锁次数
        // 解锁次数 = actionCount - 2（因为初始有2个行动）
        const unlockCount = actionCount - 2;
        return unlockCount >= 0 && unlockCount % 3 === 0;
    }
    
    // 检查是否需要增加耐心
    function shouldIncreasePatience(actionCount) {
        // 每解锁5次行动时增加耐心值
        // actionCount是当前行动数，而我们关心的是解锁次数
        // 解锁次数 = actionCount - 2（因为初始有2个行动）
        const unlockCount = actionCount - 2;
        return unlockCount > 0 && unlockCount % 5 === 0;
    }
    
    // 获取行动效果文本描述
    function getActionEffectText(action) {
        if (!ACTION_EFFECTS[action]) return '';
        
        const effects = [];
        Object.entries(ACTION_EFFECTS[action]).forEach(([stat, value]) => {
            if (value > 0) {
                effects.push(`${stat}+${value}`);
            } else {
                effects.push(`${stat}${value}`);
            }
        });
        
        return effects.join(' ');
    }
    
    // 播放动画
    function startPlayback() {
        if (isPlaying) return;
        
        const startPlayingAudio = async () => {
            try {
                // 初始化音频上下文（如果还未初始化）
                if (!audioContext || !audioInitialized) {
                    await initAudio();
                }
                
                if (audioContext.state === 'suspended') {
                    await audioContext.resume();
                }
                
                if (audioContext.state !== 'running') {
                    console.warn('音频上下文状态不是running:', audioContext.state);
                    setTimeout(startPlayingAudio, 100); // 尝试再次启动
                    return;
                }
                
                // 开始播放
                startPlaybackAfterAudioInit();
            } catch (error) {
                console.error('启动播放错误:', error);
                alert('播放失败，请重试');
            }
        };
        
        startPlayingAudio();
    }
    
    // 在音频初始化后开始播放
    function startPlaybackAfterAudioInit() {
        isPlaying = true;
        lastTriggeredColumn = -1;
        startTime = audioContext.currentTime;
        lastCycleTime = startTime; // 初始化上次循环计数时间
        
        // 重置播放头位置到第一个节拍的左侧
        playhead.style.left = '90px';
        
        // 播放背景节奏
        playBackgroundRhythm();
        
        // 开始动画
        animatePlayhead();
        
        console.log('播放开始，ANIMATION_DURATION:', ANIMATION_DURATION);
    }
    
    // 停止播放
    function stopPlayback() {
        isPlaying = false;
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        
        // 停止背景节奏
        stopBackgroundRhythm();
        
        // 重置播放头位置到第一个节拍的左侧
        playhead.style.left = '90px';
        
        // 重置最后触发的列
        lastTriggeredColumn = -1;
        
        // 清除所有当前列标记
        document.querySelectorAll('.grid-cell.current').forEach(cell => {
            cell.classList.remove('current');
        });
    }
    
    // 音量条动画函数 - 模拟调音器音量条随音乐节奏上下振动
    function animateVolumeBar(attr) {
        // 查找对应属性的音量条
        const volumeBarContainer = document.querySelector(`.volume-bar-container.${attr}-bar`);
        if (!volumeBarContainer) return;
        
        const volumeBar = volumeBarContainer.querySelector('.volume-bar');
        if (!volumeBar) return;
        
        // 找到残影层
        const trailBar = volumeBarContainer.querySelector('.volume-bar-trail');
        if (!trailBar) return;
        
        // 存储原始宽度
        const originalWidth = volumeBar.style.width;
        
        // 在动画开始前更新残影宽度，以原始宽度作为残影基准点
        const currentTrailWidth = volumeBarContainer.getAttribute('data-trail-width');
        const newWidth = parseFloat(originalWidth);
        
        // 仅当新宽度比当前残影宽度大时更新残影
        if (!currentTrailWidth || newWidth > parseFloat(currentTrailWidth)) {
            trailBar.style.width = originalWidth;
            volumeBarContainer.setAttribute('data-trail-width', newWidth);
            
            // 在更新残影宽度后，启动缩短动画 - 移除过渡然后立即恢复过渡
            trailBar.style.transition = 'none';
            void trailBar.offsetWidth; // 强制重排
            
            // 根据属性设置不同的动画时长，使残影效果错开
            let transitionDuration;
            switch(attr) {
                case 'money': transitionDuration = '2.5s'; break;
                case 'knowledge': transitionDuration = '3s'; break;
                case 'desire': transitionDuration = '3.5s'; break;
                default: transitionDuration = '3s';
            }
            
            trailBar.style.transition = `width ${transitionDuration} linear`;
            
            // 错开时间启动缩短动画，避免所有属性同时缩短
            setTimeout(() => {
                trailBar.style.width = '0%';
            }, attr === 'money' ? 200 : (attr === 'knowledge' ? 350 : 500));
        }
        
        // 创建一个随机振动效果
        let animationCount = 0;
        const maxAnimations = 8; // 增加振动次数
        const baseDelay = 60;
        
        const animate = () => {
            if (animationCount >= maxAnimations) {
                // 动画结束，恢复原始宽度
                volumeBar.style.width = originalWidth;
                return;
            }
            
            // 生成完全随机宽度 (0-100%)
            const randomPercentage = Math.random() * 100;
            volumeBar.style.width = `${randomPercentage}%`;
            
            // 添加动画类
            volumeBar.classList.add('volume-bar-animate');
            
            // 短暂延迟后移除动画类
            setTimeout(() => {
                volumeBar.classList.remove('volume-bar-animate');
                animationCount++;
                
                // 根据动画计数动态调整延迟时间，创造渐渐平息的效果
                const dynamicDelay = baseDelay + (animationCount * 20);
                
                // 继续下一次动画
                setTimeout(animate, dynamicDelay);
            }, 120);
        };
        
        // 开始动画
        animate();
    }
    
    // 更新玩家属性值并触发音量条动画
    function updatePlayerStat(stat, value) {
        // 获取旧值
        const oldValue = playerStats[stat];
        
        // 更新值
        playerStats[stat] = value;
        
        // 更新显示
        updateStatsDisplay();
        
        // 如果是效率或耐心属性，更新二级属性显示
        if (stat === '效率' || stat === '耐心') {
            updateSecondaryStats();
        }
        
        // 如果是主要属性（金钱、见闻、欲望），总是触发动画（不管值是否变化）
        if (['金钱', '见闻', '欲望'].includes(stat)) {
            // 确定对应的bar类名
            let barClass;
            switch(stat) {
                case '金钱': barClass = 'money'; break;
                case '见闻': barClass = 'knowledge'; break;
                case '欲望': barClass = 'desire'; break;
                default: return; // 其他属性不触发动画
            }
            
            // 初始化时延迟触发残影效果，以确保DOM已完全加载
            setTimeout(() => {
                // 触发音量条动画
                animateVolumeBar(barClass);
            }, 100);
            
            // 在控制台记录值的变化，便于调试
            console.log(`属性 ${stat} 从 ${oldValue} 变为 ${value}`);
        }
    }
    
    // 更新二级属性（效率和耐心）显示
    function updateSecondaryStats() {
        const efficiencyElement = document.querySelector('.right-controls .secondary-stat:first-child');
        const patienceElement = document.querySelector('.right-controls .secondary-stat:last-child');
        
        if (efficiencyElement) {
            const efficiencySpan = efficiencyElement.querySelector('span');
            if (efficiencySpan) {
                const oldValue = parseInt(efficiencySpan.textContent);
                const newValue = playerStats.效率;
                
                efficiencySpan.textContent = newValue;
                
                // 如果值增加了，添加动画效果
                if (newValue > oldValue) {
                    // 先移除可能存在的动画类
                    efficiencyElement.classList.remove('secondary-stat-flash');
                    
                    // 触发重排
                    void efficiencyElement.offsetWidth;
                    
                    // 添加动画类
                    efficiencyElement.classList.add('secondary-stat-flash');
                    
                    // 一段时间后移除动画类
                    setTimeout(() => {
                        efficiencyElement.classList.remove('secondary-stat-flash');
                    }, 1000);
                }
            }
        }
        
        if (patienceElement) {
            const patienceSpan = patienceElement.querySelector('span');
            if (patienceSpan) {
                const oldValue = parseInt(patienceSpan.textContent);
                const newValue = playerStats.耐心;
                
                patienceSpan.textContent = newValue;
                
                // 如果值增加了，添加动画效果
                if (newValue > oldValue) {
                    // 先移除可能存在的动画类
                    patienceElement.classList.remove('secondary-stat-flash');
                    
                    // 触发重排
                    void patienceElement.offsetWidth;
                    
                    // 添加动画类
                    patienceElement.classList.add('secondary-stat-flash');
                    
                    // 一段时间后移除动画类
                    setTimeout(() => {
                        patienceElement.classList.remove('secondary-stat-flash');
                    }, 1000);
                }
            }
        }
        
        console.log(`二级属性更新 - 效率: ${playerStats.效率}, 耐心: ${playerStats.耐心}`);
    }
    
    // 在文档底部调用初始化函数
    try {
        console.log('开始游戏初始化...');
        
        // 直接调用重构顶部布局函数，确保最先执行
        const headerRestructured = restructureHeader();
        
        // 使用setTimeout延迟执行，确保DOM元素已经完全渲染
        setTimeout(() => {
            console.log('延迟执行DOM元素获取...');
            
            // 获取DOM元素
            if (!getDOMElements()) {
                console.error('无法获取关键DOM元素，中止初始化');
                window.debugLog && window.debugLog('DOM元素获取失败，可能需要刷新页面');
                return;
            }
            
            // 继续其他初始化
            console.log('DOM元素获取成功，继续初始化...');
            
            // 确保二级属性正确显示
            updateSecondaryStats();
            
            // 初始化 - 如果上面的restructureHeader失败，就使用HTML中已有的元素，不再尝试重构
            if (headerRestructured) {
                console.log('使用重构后的顶部栏布局');
                initialize();
            } else {
                console.log('使用HTML中的默认顶部栏布局');
                // 跳过重构步骤，直接进行其他初始化
                initGrid();
                initTrackButtons();
                initPresetNotes();
                initAudio();
                updateStatsDisplay();
                updateAllActionButtonStyles();
                updateUnlockButtonState();
                
                // 确保播放和重置按钮已绑定事件
                const defaultPlayButton = document.getElementById('playButton');
                const defaultResetButton = document.getElementById('resetButton');
                
                if (defaultPlayButton) {
                    defaultPlayButton.addEventListener('click', () => {
                        if (isPlaying) {
                            stopPlayback();
                        } else {
                            startPlayback();
                        }
                    });
                }
                
                if (defaultResetButton) {
                    defaultResetButton.addEventListener('click', resetPlayCount);
                }
            }
            
            console.log('游戏初始化完成');
        }, 100); // 添加短暂延迟，等待DOM渲染
        
    } catch (error) {
        console.error('游戏初始化失败：', error);
        alert('游戏加载出错，请刷新页面重试');
    }
    
    // 各行动类型的触发次数统计
    const actionTriggerCounts = {};
    
    // 曲名和音乐家点评数据
    const musicTitles = {
        '工作': {
            title: '《奋进进行曲》',
            musician: '贝多芬',
            quote: '每一个努力的音符都是对时光的尊重，这首曲子展现了生活的韧性与坚持不懈的力量。'
        },
        '吃饭': {
            title: '《味觉交响曲》',
            musician: '莫扎特',
            quote: '生命需要滋养，正如音乐需要旋律。这种轻快的节奏让人想起了生活中的简单幸福。'
        },
        '阅读': {
            title: '《知识的回响》',
            musician: '巴赫',
            quote: '书中的智慧如同复调音乐，层层叠加，在心灵中形成和谐的共鸣，引领我们超越自我。'
        },
        '听歌': {
            title: '《音乐中的音乐》',
            musician: '德彪西',
            quote: '聆听是一种艺术，这首曲子捕捉了那微妙的心灵震颤，每个音符都是对另一个世界的窥探。'
        },
        '看剧': {
            title: '《戏剧变奏曲》',
            musician: '柴可夫斯基',
            quote: '故事的起伏如同激情的乐章，在你的生活中编织出一幅色彩斑斓的情感画卷。'
        },
        '玩游戏': {
            title: '《欢愉奏鸣曲》',
            musician: '海顿',
            quote: '游戏的本质是创造性的探索，就像这首曲子充满了俏皮的音符和意外的转折，令人忍俊不禁。'
        },
        '聊天': {
            title: '《对话即兴曲》',
            musician: '舒曼',
            quote: '交流的艺术在于倾听与表达的平衡，这首曲子捕捉了那种自然流动的情感交织。'
        },
        '运动': {
            title: '《活力狂想曲》',
            musician: '李斯特',
            quote: '身体的韵律是最原始的音乐，这种充满动感的节奏仿佛能唤醒灵魂深处的生命力。'
        },
        '创作': {
            title: '《创造者的梦》',
            musician: '肖邦',
            quote: '每一次创作都是灵感与技艺的完美结合，这首曲子展现了思想的流淌与迸发的瞬间。'
        },
        '学习': {
            title: '《求知圆舞曲》',
            musician: '勃拉姆斯',
            quote: '学习是一场永不停息的舞蹈，每一步都通向新的高度，就像这首曲子中的每一个旋律。'
        },
        '刷手机': {
            title: '《数字摇篮曲》',
            musician: '德沃夏克',
            quote: '现代生活的节奏在指尖流转，这首曲子捕捉了那种微妙的连接与短暂的宁静。'
        },
        '上厕所': {
            title: '《冥想小夜曲》',
            musician: '拉威尔',
            quote: '最朴素的时刻往往蕴含深刻的思考，这首曲子中的静谧让人找到内心的片刻宁静。'
        },
        '闲逛': {
            title: '《漫步随想曲》',
            musician: '舒伯特',
            quote: '漫无目的的行走是灵魂的自由表达，这首曲子的流动感如同思绪在城市或乡间的闲适徜徉。'
        },
        '炒股': {
            title: '《市场波动奏鸣曲》',
            musician: '斯特拉文斯基',
            quote: '金融的不确定性如同我的现代音乐，充满了张力与意外，但其中蕴含着深刻的秩序规律。'
        },
        '发呆': {
            title: '《冥想前奏曲》',
            musician: '萨蒂',
            quote: '出神的时刻是灵感的温床，这首曲子的简约与重复创造了一种超越时间的空灵状态。'
        },
        '睡觉': {
            title: '《梦境协奏曲》',
            musician: '马勒',
            quote: '睡眠是生命的神秘仪式，这首曲子带我们进入潜意识的海洋，在那里时间失去了意义。'
        }
    };
    
    // 默认的音乐家点评（如果找不到对应行动的点评）
    const defaultMusicInfo = {
        title: '《生活律动》',
        musician: '巴赫',
        quote: '生活如音乐，需要不同的节奏、音符和停顿，才能构成一首完美的交响乐。'
    };
    
    // 获取触发次数最多的行动
    function getMostTriggeredAction() {
        let maxCount = 0;
        let mostTriggeredAction = null;
        
        Object.entries(actionTriggerCounts).forEach(([action, count]) => {
            if (count > maxCount) {
                maxCount = count;
                mostTriggeredAction = action;
            }
        });
        
        return mostTriggeredAction || ACTION_TYPES[0]; // 默认返回第一个行动类型
    }
    
    // 修改结算条件，只在游戏完全结束时显示结算界面
    function checkSettlementCondition() {
        // 只在游戏完成60天时显示结算界面
        return playCounter >= PLAY_LIMIT;
    }

    // 背景节奏音频源
    let backgroundRhythmSource = null;
    let backgroundRhythmGain = null;

    // 播放背景节奏
    function playBackgroundRhythm() {
        // 如果已经有正在播放的背景节奏，则停止它
        stopBackgroundRhythm();
        
        // 确保背景节奏音频已加载
        if (!audioBuffers['base_rhythm']) {
            console.warn('背景节奏音频未加载，尝试加载');
            window.debugLog && window.debugLog('背景节奏未加载，尝试加载');
            
            // 尝试加载背景节奏
            loadSound('base_rhythm')
                .then(buffer => {
                    console.log('成功加载背景节奏');
                    audioBuffers['base_rhythm'] = buffer;
                    startBackgroundRhythmPlayback();
                })
                .catch(error => {
                    console.error('加载背景节奏失败，使用空白音频:', error);
                    // 使用空白音频
                    audioBuffers['base_rhythm'] = createEmptyBuffer();
                    startBackgroundRhythmPlayback();
                });
        } else {
            startBackgroundRhythmPlayback();
        }
    }

    // 启动背景节奏播放准备
    function startBackgroundRhythmPlayback() {
        try {
            // 如果已存在，先清理
            if (backgroundRhythmSource) {
                try {
                    backgroundRhythmSource.stop();
                } catch (e) {
                    // 忽略错误
                }
                backgroundRhythmSource = null;
            }
            
            if (backgroundRhythmGain) {
                try {
                    backgroundRhythmGain.disconnect();
                } catch (e) {
                    // 忽略错误
                }
            }
            
            // 创建增益节点
            backgroundRhythmGain = audioContext.createGain();
            backgroundRhythmGain.gain.value = 0.15; // 设置较低的音量
            backgroundRhythmGain.connect(audioContext.destination);
            
            console.log('背景节奏已准备好，等待格子激活触发');
            window.debugLog && window.debugLog('背景节奏已准备好');
        } catch (error) {
            console.error('准备背景节奏错误:', error);
            window.debugLog && window.debugLog(`背景节奏准备错误: ${error.message}`);
        }
    }

    // 停止背景节奏
    function stopBackgroundRhythm() {
        if (backgroundRhythmSource) {
            try {
                backgroundRhythmSource.stop();
                backgroundRhythmSource.isPlaying = false;
            } catch (error) {
                // 忽略已停止的音频源错误
            }
            backgroundRhythmSource = null;
        }
        
        if (backgroundRhythmGain) {
            try {
                backgroundRhythmGain.disconnect();
            } catch (error) {
                // 忽略断开连接错误
            }
            backgroundRhythmGain = null;
        }
        
        console.log('背景节奏已停止');
    }

    // 测试音频加载和播放函数
    function testAudio(action) {
        console.log(`开始测试音频: ${action || 'all'}`);
        window.debugLog && window.debugLog(`测试音频: ${action || 'all'}`);
        
        if (!audioContext) {
            console.error('音频上下文不存在，创建新的');
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        if (audioContext.state === 'suspended') {
            console.log('恢复音频上下文');
            audioContext.resume();
        }
        
        // 如果指定了特定行动，只测试那个行动的音频
        if (action && ACTION_TYPES.includes(action)) {
            const soundFileName = `snd_${actionToFileName(action)}`;
            console.log(`测试单个音频: ${action} -> ${soundFileName}`);
            
            loadSound(soundFileName)
                .then(buffer => {
                    console.log(`${action}音频加载成功，尝试播放`);
                    
                    // 播放音频
                    const source = audioContext.createBufferSource();
                    source.buffer = buffer;
                    source.connect(audioContext.destination);
                    source.start(0);
                    
                    // 更新缓冲区
                    audioBuffers[action] = buffer;
                    
                    console.log(`${action}音频播放成功`);
                    window.debugLog && window.debugLog(`${action}音频播放成功`);
                })
                .catch(error => {
                    console.error(`${action}音频测试失败:`, error);
                    window.debugLog && window.debugLog(`${action}音频测试失败`);
                });
        } 
        // 测试基础节奏
        else if (action === 'base_rhythm') {
            console.log('测试基础节奏音频');
            
            loadSound('base_rhythm')
                .then(buffer => {
                    console.log('基础节奏音频加载成功，尝试播放');
                    
                    // 播放音频
                    const source = audioContext.createBufferSource();
                    source.buffer = buffer;
                    source.connect(audioContext.destination);
                    source.start(0);
                    
                    // 更新缓冲区
                    audioBuffers['base_rhythm'] = buffer;
                    
                    console.log('基础节奏音频播放成功');
                    window.debugLog && window.debugLog('基础节奏音频播放成功');
                })
                .catch(error => {
                    console.error('基础节奏音频测试失败:', error);
                    window.debugLog && window.debugLog('基础节奏音频测试失败');
                });
        }
        // 如果没有指定行动，测试所有音频
        else {
            console.log('测试所有音频');
            // 重新初始化所有音频
            initAudio().then(() => {
                console.log('所有音频初始化完成');
                window.debugLog && window.debugLog('所有音频初始化完成');
            });
        }
    }

    // 将测试函数暴露给全局作用域，方便在控制台调用
    window.testAudio = testAudio;

    // 资源初始化函数
    async function initializeResources() {
        // 更新加载状态
        updateLoadingStatus('正在初始化游戏资源...', 5);
        
        try {
            // 确保音频相关变量已初始化
            if (typeof audioBuffers === 'undefined') {
                audioBuffers = {};
            }
            
            // activeSounds已在全局初始化，无需重复检查
            
            // 创建音频上下文
            let audioContextCreated = false;
            if (!audioContext) {
                try {
                    audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    audioContextCreated = true;
                    
                    // 监听音频上下文状态变化
                    audioContext.onstatechange = () => {
                        console.log('音频上下文状态变化:', audioContext.state);
                        window.debugLog && window.debugLog(`音频上下文状态: ${audioContext.state}`);
                    };
                } catch (audioError) {
                    console.error('无法创建音频上下文:', audioError);
                    window.debugLog && window.debugLog('音频初始化失败，游戏将无声运行');
                    updateLoadingStatus('无法创建音频上下文，游戏将以静音模式运行', 20);
                    await new Promise(resolve => setTimeout(resolve, 1500)); // 显示错误消息1.5秒
                }
            } else {
                audioContextCreated = true;
            }
            
            // 获取所有需要加载的音频文件
            updateLoadingStatus('准备加载音频文件...', 10);
            
            let audioLoadSuccess = false;
            
            // 初始化音频
            if (audioContextCreated) {
                try {
                    audioLoadSuccess = await initAudio();
                    if (!audioLoadSuccess) {
                        throw new Error('音频加载失败');
                    }
                } catch (audioError) {
                    console.error('音频加载失败:', audioError);
                    window.debugLog && window.debugLog('音频加载失败，使用备用生成音效');
                    updateLoadingStatus('音频加载失败，使用备用音效...', 80);
                    await new Promise(resolve => setTimeout(resolve, 1500)); // 显示错误消息1.5秒
                    
                    // 使用备用的生成音效
                    try {
                        // 为所有行动生成备用音效
                        updateLoadingStatus('生成备用音效中...', 85);
                        
                        // 只有在audioContext存在时才尝试生成音效
                        if (audioContext) {
                            for (const action of ACTION_TYPES) {
                                const buffer = await generateSound(action);
                                audioBuffers[action] = buffer;
                            }
                            
                            // 创建一个空白的背景节奏
                            audioBuffers['base_rhythm'] = createEmptyBuffer();
                            
                            // 标记为初始化完成
                            audioInitialized = true;
                            audioLoadSuccess = true;
                        } else {
                            // 如果没有audioContext，创建一些空对象作为占位符
                            console.warn('无法生成备用音效，游戏将以静音模式运行');
                            for (const action of ACTION_TYPES) {
                                audioBuffers[action] = {
                                    duration: 0.5,
                                    numberOfChannels: 1,
                                    length: 22050,
                                    getChannelData: function() {
                                        return new Float32Array(22050);
                                    }
                                };
                            }
                            
                            // 背景节奏占位符
                            audioBuffers['base_rhythm'] = {
                                duration: 0.1,
                                numberOfChannels: 1,
                                length: 4410,
                                getChannelData: function() {
                                    return new Float32Array(4410);
                                }
                            };
                            
                            // 标记为初始化完成（静音模式）
                            audioInitialized = true;
                            audioLoadSuccess = false;
                        }
                        
                        updateLoadingStatus('备用音效生成完成', 95);
                    } catch (fallbackError) {
                        console.error('备用音效也初始化失败:', fallbackError);
                        window.debugLog && window.debugLog(`备用音效初始化失败: ${fallbackError.message}`);
                        updateLoadingStatus('音效初始化完全失败，游戏将无声运行', 90);
                        await new Promise(resolve => setTimeout(resolve, 1500)); // 显示错误消息1.5秒
                        
                        // 即使是备用音效也失败了，设置为静音模式
                        audioInitialized = true;
                        audioLoadSuccess = false;
                    }
                }
            } else {
                // 如果无法创建音频上下文，创建空的音频缓冲区
                updateLoadingStatus('使用静音模式...', 30);
                
                // 创建空的音频缓冲区作为占位符
                for (const action of ACTION_TYPES) {
                    audioBuffers[action] = {
                        duration: 0.5,
                        numberOfChannels: 1,
                        length: 22050,
                        getChannelData: function() {
                            return new Float32Array(22050);
                        }
                    };
                }
                
                // 背景节奏占位符
                audioBuffers['base_rhythm'] = {
                    duration: 0.1,
                    numberOfChannels: 1,
                    length: 4410,
                    getChannelData: function() {
                        return new Float32Array(4410);
                    }
                };
                
                // 标记为初始化完成（静音模式）
                audioInitialized = true;
                audioLoadSuccess = false;
                
                // 显示静音模式提示
                updateLoadingStatus('游戏将以静音模式运行', 90);
                await new Promise(resolve => setTimeout(resolve, 1500)); // 显示信息1.5秒
            }
            
            // 所有资源加载完成
            updateLoadingStatus('资源加载完成！准备开始游戏...', 100);
            initialLoadComplete = true;
            
            return audioLoadSuccess;
        } catch (error) {
            console.error('初始化资源失败:', error);
            updateLoadingStatus('资源加载失败: ' + error.message, 100);
            await new Promise(resolve => setTimeout(resolve, 2000)); // 显示错误消息2秒
            
            // 资源加载彻底失败，但仍允许游戏启动
            initialLoadComplete = true;
            
            // 创建空的占位符，使游戏能够在静音模式下运行
            try {
                for (const action of ACTION_TYPES) {
                    audioBuffers[action] = {
                        duration: 0.5,
                        numberOfChannels: 1,
                        length: 22050,
                        getChannelData: function() {
                            return new Float32Array(22050);
                        }
                    };
                }
                
                // 背景节奏占位符
                audioBuffers['base_rhythm'] = {
                    duration: 0.1,
                    numberOfChannels: 1,
                    length: 4410,
                    getChannelData: function() {
                        return new Float32Array(4410);
                    }
                };
                
                // 标记为初始化完成（静音模式）
                audioInitialized = true;
            } catch (e) {
                console.error('创建音频占位符失败:', e);
            }
            
            return false;
        }
    }

    // 更新加载状态
    function updateLoadingStatus(message, progress) {
        // 更新加载进度条
        if (loadingProgressBar) {
            loadingProgressBar.style.width = `${progress}%`;
        }
        
        // 更新加载状态文本
        if (loadingStatus) {
            loadingStatus.textContent = message;
        }
        
        console.log(`加载进度 ${progress}%: ${message}`);
    }
}); 