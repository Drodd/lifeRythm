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

document.addEventListener('DOMContentLoaded', () => {
    // 常量定义
    const BPM = 280;
    const PLAY_LIMIT = 60;
    const GRID_COLUMNS = 8;
    const BEAT_DURATION = 60 / BPM; // 一拍的持续时间（秒）- 修正为60/BPM
    const ANIMATION_DURATION = BEAT_DURATION * GRID_COLUMNS; // 总动画时间
    
    // 行动列表 (原音效列表)
    const ACTION_TYPES = [
        '工作', '吃饭', '阅读', '听歌', '看剧', 
        '玩游戏', '聊天', '运动', '创作', '学习', 
        '刷手机', '上厕所', '闲逛', 
        '泡茶', '炒股', '发呆', '睡觉'
    ];
    
    // 已添加的行动（初始有2个）
    const addedActions = [
        { id: '工作', name: '工作' },
        { id: '吃饭', name: '吃饭' }
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
        trackList = null; // 不再使用轨道列表
        gridContainer = document.getElementById('gridContainer');
        playButton = document.getElementById('playButton');
        resetButton = document.getElementById('resetButton');
        playCount = document.getElementById('playCount');
        playLimit = document.getElementById('playLimit');
        playhead = document.querySelector('.playhead');
        statsContainer = document.getElementById('statsContainer');
        compositionArea = document.querySelector('.combined-area');
        
        // 检查是否所有必要的元素都被找到
        if (!gridContainer || !playButton || !resetButton || 
            !playCount || !playLimit || !playhead || 
            !statsContainer || !compositionArea) {
            console.error('DOM元素获取失败，页面可能无法正常初始化');
            console.log('缺失元素: ', 
                !gridContainer ? 'gridContainer ' : '',
                !playButton ? 'playButton ' : '',
                !resetButton ? 'resetButton ' : '',
                !playCount ? 'playCount ' : '',
                !playLimit ? 'playLimit ' : '',
                !playhead ? 'playhead ' : '',
                !statsContainer ? 'statsContainer ' : '',
                !compositionArea ? 'compositionArea ' : ''
            );
            
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
            errorMessage.textContent = '页面加载错误，请刷新页面重试';
            document.body.appendChild(errorMessage);
            return false; // 获取元素失败
        }
        return true; // 获取元素成功
    }
    
    // 先尝试获取DOM元素
    if (!getDOMElements()) {
        return; // 中止初始化
    }
    
    // 基于解锁次数计算见闻需求
    function calculateKnowledgeRequirement(unlockCount) {
        // 初始两个行动无需见闻值（工作和吃饭）
        // 从第3个行动开始需要见闻值
        const baseRequirement = 10; // 第一次解锁需要10点见闻
        const increaseRate = 10 * unlockCount;    // 每次增加10*解锁次数
        
        if (unlockCount < 2) {
            return 0;
        }
        
        // 解锁次数从0开始计算，所以第3个行动是unlockCount=2
        return baseRequirement + (unlockCount - 2) * increaseRate;
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
    
    // 音频上下文
    let audioContext;
    let audioBuffers = {};
    let audioInitialized = false; // 标记音频是否已初始化
    
    // 音符数据（行动 => 列位置的集合）
    const noteData = {};
    
    // 行动对属性的影响映射
    const ACTION_EFFECTS = {
        '工作': { 金钱: 2, 见闻: 1, 欲望: 1 },
        '吃饭': { 金钱: -1, 欲望: -1 },
        '阅读': { 见闻: 2, 欲望: -1 },
        '听歌': { 见闻: 1, 欲望: -1 },
        '看剧': { 见闻: 1, 欲望: -1 },
        '玩游戏': { 见闻: 1, 欲望: 1 },
        '聊天': { 见闻: 1, 欲望: 1 },
        '运动': { 见闻: 1, 欲望: -2 },
        '创作': { 见闻: 2, 欲望: -1 },
        '学习': { 见闻: 2, 欲望: 1 },
        '刷手机': { 见闻: 1 , 欲望: 2 },
        '上厕所': { 见闻: -1, 欲望: -1 },
        '闲逛': { 见闻: 1 },
        '冲咖啡': { 欲望: -1 },
        '炒股': { 见闻: 1, 欲望: 1 },
        '发呆': { 欲望: -1 },
        '睡觉': { 欲望: -1 },
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
        '泡茶': '🍵',
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
        
        // 创建属性行容器
        const statsRows = document.createElement('div');
        statsRows.className = 'stats-rows';
        
        // 创建一级属性行（金钱、见闻、欲望）
        const primaryStats = document.createElement('div');
        primaryStats.className = 'primary-stats';
        
        // 创建二级属性行（见闻、效率、耐心）
        const secondaryStats = document.createElement('div');
        secondaryStats.className = 'secondary-stats';
        
        // 添加一级属性 - 金钱（突出显示）
        const moneyItem = document.createElement('div');
        moneyItem.className = 'primary-stat money-stat highlighted-stat';
        moneyItem.innerHTML = `<span class="stat-icon">💰</span><span class="stat-name">金钱</span><span class="stat-value">${playerStats.金钱}</span>`;
        primaryStats.appendChild(moneyItem);
        
        // 添加一级属性 - 见闻（突出显示）
        const knowledgeItem = document.createElement('div');
        knowledgeItem.className = 'primary-stat knowledge-stat highlighted-stat';
        knowledgeItem.innerHTML = `<span class="stat-icon">📚</span><span class="stat-name">见闻</span><span class="stat-value">${playerStats.见闻}</span>`;
        primaryStats.appendChild(knowledgeItem);
        
        // 欲望属性（使用进度条）
        const desireItem = document.createElement('div');
        desireItem.className = 'primary-stat desire-stat';
        desireItem.title = '每天结束时，欲望值会消耗等量的金钱';
        
        // 创建进度条容器
        const progressContainer = document.createElement('div');
        progressContainer.className = 'progress-container';
        
        // 创建进度条
        const progressBar = document.createElement('progress');
        // 设置进度条最大值为当前金钱值（如果金钱为0则设为1以避免显示问题）
        const maxValue = Math.max(1, playerStats.金钱);
        progressBar.max = maxValue;
        progressBar.value = Math.min(playerStats.欲望, maxValue); // 确保不超过最大值
        
        // 创建进度条文本
        const progressText = document.createElement('span');
        progressText.className = 'progress-text';
        progressText.textContent = playerStats.欲望;
        
        // 组装进度条元素
        progressContainer.appendChild(progressBar);
        progressContainer.appendChild(progressText);
        
        // 设置标签和进度条
        desireItem.innerHTML = `<span class="stat-icon">🔥</span><span class="stat-name">欲望</span>`;
        desireItem.appendChild(progressContainer);
        primaryStats.appendChild(desireItem);
        
        // 添加二级属性 - 效率
        const efficiencyItem = document.createElement('div');
        efficiencyItem.className = 'secondary-stat';
        efficiencyItem.title = '效率决定了每个节拍可激活的最大行动数量';
        efficiencyItem.innerHTML = `效率: <span>${playerStats.效率}</span>`;
        secondaryStats.appendChild(efficiencyItem);
        
        // 添加二级属性 - 耐心
        const patienceItem = document.createElement('div');
        patienceItem.className = 'secondary-stat';
        patienceItem.title = '耐心决定了一个行动可以连续激活的最大数量';
        patienceItem.innerHTML = `耐心: <span>${playerStats.耐心}</span>`;
        secondaryStats.appendChild(patienceItem);
        
        // 组装属性容器
        statsRows.appendChild(primaryStats);
        statsRows.appendChild(secondaryStats);
        statsContainer.appendChild(statsRows);
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
        if (audioInitialized) return; // 已初始化则直接返回
        
        try {
            // 创建音频上下文
            if (!audioContext) {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                
                // 监听音频上下文状态变化
                audioContext.onstatechange = () => {
                    console.log('音频上下文状态变化:', audioContext.state);
                };
            }
            
            // 使用简单的音频生成替代真实音频文件
            const promises = [];
            for (const action of ACTION_TYPES) {
                promises.push(generateSound(action).then(buffer => {
                    audioBuffers[action] = buffer;
                }));
            }
            
            // 等待所有音频生成完成
            await Promise.all(promises);
            
            console.log('音频初始化完成');
            audioInitialized = true; // 标记音频已初始化
            return true;
        } catch (error) {
            console.error('初始化音频失败:', error);
            return false;
        }
    }
    
    // 生成简单的合成声音 (保留原有音效逻辑，但将类型映射到行动)
    function generateSound(action) {
        return new Promise((resolve) => {
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
            else if (action === '吃饭' || action === '喝水' || action === '冲咖啡' || action === '泡茶' || action === '上厕所') {
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
            else if (action === '听歌' || action === '发呆' || action === '睡觉' || action === '冥想') {
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
            
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffers[actionId];
            
            // 创建增益节点控制音量
            const gainNode = audioContext.createGain();
            gainNode.gain.value = 0.5;
            
            // 连接音频节点
            source.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            // 播放音频
            source.start(0);
            
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
                                playerStats[stat] += value;
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
                    // 应用变化
                    playerStats.金钱 += moneyChange;
                    
                    // 显示炒股结果提示
                    if (moneyChange > 0) {
                        showStockResultMessage(moneyChange, true); // 盈利
                    } else if (moneyChange < 0) {
                        showStockResultMessage(Math.abs(moneyChange), false); // 亏损
                    }
                }
                
                // 更新属性显示
                updateStatsDisplay();
                
                // 更新解锁按钮状态 - 检查是否可以解锁新行动
                updateUnlockButtonState();
            }
        } catch (error) {
            console.error('播放声音错误:', error);
        }
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
                    playerStats.金钱 -= playerStats.欲望;
                    
                    // 显示欲望消费提示
                    showDesireConsumptionMessage(playerStats.欲望);
                    
                    // 消费后将欲望清零
                    const consumedDesire = playerStats.欲望;
                    playerStats.欲望 = 0;
                    
                    // 检查金钱是否小于等于0
                    if (playerStats.金钱 <= 0) {
                        playerStats.金钱 = 0; // 确保金钱不会显示为负数
                        updateStatsDisplay();
                        stopPlayback();
                        showGameOverMessage("你破产了！欲望消耗了你所有的财富。");
                        return;
                    }
                }
                
                updateStatsDisplay();
                
                // 检查是否达到播放上限
                if (playCounter >= PLAY_LIMIT) {
                    stopPlayback();
                    showGameOverMessage("恭喜你度过了60天！");
                    return;
                }
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
        
        // 触发每个激活的音符，立即更新属性和视觉效果
        activeCells.forEach(cell => {
            const actionId = cell.getAttribute('data-action');
            if (actionId && noteData[actionId] && noteData[actionId][column]) {
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
            // 效率重置为1，耐心重置为3，其他重置为0
            if (stat === '效率') {
                playerStats[stat] = 1;
            } else if (stat === '耐心') {
                playerStats[stat] = 3;
            } else {
                playerStats[stat] = 0;
            }
        });
        
        // 更新属性显示
        updateStatsDisplay();
        
        // 清空所有音符
        Object.keys(noteData).forEach(action => {
            noteData[action] = {};
        });
        
        // 重置行动列表到初始状态（只保留工作和吃饭）
        addedActions.length = 0;
        addedActions.push({ id: '工作', name: '工作' });
        addedActions.push({ id: '吃饭', name: '吃饭' });
        
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
            playerStats.效率 += 1;
            newEfficiency = playerStats.效率;
            efficiencyIncreased = true;
        }
        
        // 检查是否需要增加耐心
        if (shouldIncreasePatience(addedActions.length)) {
            playerStats.耐心 += 1;
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
            // 满足解锁条件，随机选择一个行动解锁
            const randomAction = getNextUnlockableAction();
            if (randomAction) {
                addAction(randomAction);
                // 解锁后重新检查（以防有多个行动可以解锁）
                setTimeout(updateUnlockButtonState, 100);
            }
        } else {
            // 未达到解锁条件，更新按钮文本为解锁需要的见闻值
            addTrackButton.textContent = `见闻${requiredKnowledge} 领悟`;
            addTrackButton.disabled = true;
            addTrackButton.classList.add('disabled');
            addTrackButton.classList.remove('unlockable');
        }
    }
    
    // 显示欲望消费提示信息（放在欲望进度条下方）
    function showDesireConsumptionMessage(amount) {
        // 先删除可能存在的旧消息
        const oldMessages = document.querySelectorAll('.desire-consumption-message');
        oldMessages.forEach(msg => {
            if (msg.parentNode) {
                msg.parentNode.removeChild(msg);
            }
        });
        
        // 获取欲望进度条的位置
        const desireStat = document.querySelector('.desire-stat');
        if (!desireStat) {
            console.warn('找不到欲望进度条元素');
            return;
        }
        
        // 获取主要属性行容器
        const primaryStats = document.querySelector('.primary-stats');
        if (!primaryStats) {
            console.warn('找不到主要属性行容器');
            return;
        }
        
        // 创建消息元素
        const message = document.createElement('div');
        message.className = 'desire-consumption-message';
        message.innerHTML = `欲望消费了${amount}金钱`;
        
        // 设置样式为明显可见的文本
        message.style.display = 'inline-block';
        message.style.color = '#ff5252';
        message.style.backgroundColor = 'rgba(255, 82, 82, 0.1)';
        message.style.border = '1px solid #ff5252';
        message.style.borderRadius = '3px';
        message.style.fontSize = '12px';
        message.style.fontWeight = 'bold';
        message.style.padding = '2px 5px';
        message.style.marginTop = '4px';
        message.style.marginLeft = '8px';
        message.style.position = 'absolute';
        message.style.zIndex = '100';
        
        // 添加到主要属性行下方
        document.body.appendChild(message);
        
        // 计算位置：欲望属性下方
        const desireRect = desireStat.getBoundingClientRect();
        message.style.top = `${desireRect.bottom + 5}px`;
        message.style.left = `${desireRect.left}px`;
        
        // 3秒后移除消息
        setTimeout(() => {
            if (message.parentNode) {
                message.parentNode.removeChild(message);
            }
        }, 3000);
    }
    
    // 显示游戏结束信息
    function showGameOverMessage(message) {
        // 创建一个模态对话框
        const modal = document.createElement('div');
        modal.className = 'game-over-modal';
        modal.innerHTML = `
            <div class="game-over-content">
                <h2>游戏结束</h2>
                <p>${message}</p>
                <button id="restartButton">重新开始</button>
            </div>
        `;
        
        // 添加到页面
        document.body.appendChild(modal);
        
        // 添加重新开始按钮事件
        document.getElementById('restartButton').addEventListener('click', () => {
            // 重置游戏
            resetPlayCount();
            
            // 移除模态框
            document.body.removeChild(modal);
        });
    }
    
    // 显示解锁提示信息（整合效率和耐心提升消息）
    function showUnlockMessage(actionName, efficiencyIncreased, newEfficiency, patienceIncreased, newPatience) {
        // 移除所有现有的解锁消息，避免叠加
        const existingMessages = document.querySelectorAll('.unlock-message');
        existingMessages.forEach(msg => {
            document.body.removeChild(msg);
        });
        
        let messageHTML = `<div>解锁了新行动!</div><div class="unlocked-action-name">${ACTION_EMOJIS[actionName] || ''} ${actionName}</div>`;
        
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
        message.innerHTML = `效率限制：每个节拍最多${efficiency}个行动`;
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
        message.innerHTML = `耐心限制：${action}最多连续激活${patience}个节拍`;
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
        const header = document.querySelector('.header');
        
        // 清空现有内容
        header.innerHTML = '';
        
        // 创建顶部行
        const headerTopRow = document.createElement('div');
        headerTopRow.className = 'header-top-row';
        
        // 创建左侧控制区（天数、重置和播放按钮）
        const leftControls = document.createElement('div');
        leftControls.className = 'left-controls';
        
        // 天数计数器
        const counter = document.createElement('div');
        counter.className = 'counter';
        counter.innerHTML = `天数: <span id="playCount">0</span>/<span id="playLimit">${PLAY_LIMIT}</span>`;
        leftControls.appendChild(counter);
        
        // 重置按钮
        const resetBtn = document.createElement('button');
        resetBtn.id = 'resetButton';
        resetBtn.className = 'control-button';
        resetBtn.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 10h7V3l-2.35 3.35z"/></svg>';
        leftControls.appendChild(resetBtn);
        
        // 播放按钮
        const playBtn = document.createElement('button');
        playBtn.id = 'playButton';
        playBtn.className = 'control-button';
        playBtn.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24"><path d="M8 5v14l11-7z"/></svg>';
        leftControls.appendChild(playBtn);
        
        // 添加到顶部行
        headerTopRow.appendChild(leftControls);
        
        // 添加统计容器
        const statsDiv = document.createElement('div');
        statsDiv.id = 'statsContainer';
        
        // 添加到顶部行
        headerTopRow.appendChild(statsDiv);
        
        // 添加顶部行到header
        header.appendChild(headerTopRow);
        
        // 重新获取DOM引用，而不是重新分配const变量
        getDOMElements();
        
        // 重新绑定事件监听器
        if (playButton) {
            playButton.addEventListener('click', () => {
                if (isPlaying) {
                    stopPlayback();
                } else {
                    startPlayback();
                }
                // 不再需要同步滚动
            });
        }
        
        if (resetButton) {
            resetButton.addEventListener('click', () => {
                resetPlayCount();
                // 不再需要同步滚动
            });
        }
    }
    
    // 初始化
    function initialize() {
        // 重构顶部布局
        restructureHeader();
        
        // 获取初始DOM元素
        getDOMElements();
        
        // 初始化网格 - 这会重新创建和引用addTrackButton
        initGrid();
        
        // 初始化其他界面元素
        initTrackButtons();
        initPresetNotes(); // 设置预设的音符模式
        initAudio();
        
        // 更新属性显示
        updateStatsDisplay();
        
        // 确保所有行动按钮的样式正确更新
        updateAllActionButtonStyles();
        
        // 更新解锁按钮状态
        updateUnlockButtonState();
        
        // 监听窗口大小变化
        window.addEventListener('resize', () => {
            // 不再需要同步滚动
        });
        
        // 监听设备方向变化（移动设备）
        window.addEventListener('orientationchange', () => {
            // 不再需要同步滚动
        });
        
        // 防止iOS上的音频问题
        document.addEventListener('touchstart', () => {
            if (audioContext && audioContext.state === 'suspended') {
                audioContext.resume();
            }
        });
    }
    
    // 初始化预设音符
    function initPresetNotes() {
        // 工作行动音符 - 适应8列布局
        const workColumns = [2, 3, 5, 6];
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
        const eatColumns = [1, 4, 7];
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
        
        // 更新播放按钮图标为暂停图标
        playButton.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
        
        // 重置播放头位置到第一个节拍的左侧
        playhead.style.left = '90px';
        
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
        
        // 更新播放按钮图标为播放图标
        playButton.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24"><path d="M8 5v14l11-7z"/></svg>';
        
        // 重置播放头位置到第一个节拍的左侧
        playhead.style.left = '90px';
        
        // 重置最后触发的列
        lastTriggeredColumn = -1;
        
        // 清除所有当前列标记
        document.querySelectorAll('.grid-cell.current').forEach(cell => {
            cell.classList.remove('current');
        });
    }
    
    // 在文档底部调用初始化函数
    try {
        // 初始化
        initialize();
        console.log('游戏初始化完成');
    } catch (error) {
        console.error('游戏初始化失败：', error);
        alert('游戏加载出错，请刷新页面重试');
    }
}); 