/**
 * CozyWebApp
 * The main object that encapsulates all the logic for The Cozy Web application.
 * This object-oriented approach keeps the global scope clean and organizes the code into manageable sections.
 */
const CozyWebApp = {
    // --- State & Properties ---
    db: null,
    alarmWorker: null,
    swiper: null,
    themeMode: 'auto',
    lastManualTheme: 'theme-default',
    lastAppliedTheme: null,
    shootingStarInterval: null,
    weatherState: null,
    weatherTimer: null,
    lastCloudCount: 0,
    currentEditingSound: null,
    currentLanguage: 'vi',
    geminiAPIKey: 'GEMINI_API_KEY',
    ytPlayer: null,

    // Default alarm sounds library
    ambientSoundFiles: {
        rain: { name_key: 'sound_name_rain', icon: 'fas fa-cloud-showers-heavy', url: 'https://www.soundjay.com/nature/rain-04.mp3' },
        river: { name_key: 'sound_name_river', icon: 'fas fa-water', url: 'https://www.soundjay.com/nature/sounds/river-2.mp3' },
        lake: { name_key: 'sound_name_lake', icon: 'fas fa-wave-square', url: 'https://www.soundjay.com/nature/sounds/lake-waves-01.mp3' },
        wind: { name_key: 'sound_name_wind', icon: 'fas fa-wind', url: 'https://www.soundjay.com/nature/wind-1.mp3' },
        campfire: { name_key: 'sound_name_campfire', icon: 'fas fa-fire', url: 'https://www.soundjay.com/nature/campfire-1.mp3' },
        ocean: { name_key: 'sound_name_ocean', icon: 'fas fa-water', url: 'https://www.soundjay.com/nature/ocean-wave-1.mp3' },
    },

    // --- MODIFIED: Changed from hardcoded strings to translation keys ---
    defaultTipKeys: [
        'tip_1', 'tip_2', 'tip_3', 'tip_4', 'tip_5',
        'tip_6', 'tip_7', 'tip_8', 'tip_9', 'tip_10'
    ],

    // Pomodoro timer settings
    pomodoro: { pomodoro: 25, shortBreak: 5, longBreak: 15, sessions: 0 },
    pomodoroInterval: null,
    pomodoroRemainingTime: 25 * 60,
    pomodoroMode: 'pomodoro',
    breathingInterval: null,
    breathingPhase: 'inhale',
    breathingTime: 4,
    breathingActive: false,
    breathingPattern: { inhale: 4, hold: 4, exhale: 4 },

    /**
     * Main initialization function for the entire application.
     * Runs once the DOM is fully loaded.
     */
    init: async function() {
        this.initDatabase();
        this.initUI();
        this.initDateTimePickers();
        this.initEventListeners();
        this.initWorker();
        await this.loadSavedData();
        this.createStars();
        this.initWeatherSystem();
        setInterval(() => this.updateClock(), 1000); 
        this.initStats();
        this.renderTipsList();
        setTimeout(() => { document.body.classList.remove('loading'); }, 100);
    },

    /**
     * Initializes the YouTube IFrame Player.
     */
    initYTPlayer: function() {
        this.ytPlayer = new YT.Player('youtube-player', {
            height: '100%',
            width: '100%',
            playerVars: { 'autoplay': 0, 'controls': 0, 'showinfo': 0, 'rel': 0, 'modestbranding': 1 },
            events: {
                'onStateChange': (event) => {
                    if (event.data === YT.PlayerState.ENDED) {
                        document.getElementById('youtube-player-wrapper').classList.add('hidden');
                    }
                }
            }
        });
    },

    // --- Core Systems: I18n, Database, Worker, UI ---
    getText: function(key) {
        return translations[this.currentLanguage]?.[key] 
            || translations['en']?.[key] 
            || `[${key}]`;
    },

    setLanguage: function(lang) {
        if (!translations[lang]) return;
        this.currentLanguage = lang;
        document.documentElement.lang = lang;

        document.querySelectorAll('[data-i18n-key]').forEach(el => el.textContent = this.getText(el.getAttribute('data-i18n-key')));
        document.querySelectorAll('[data-i18n-key-placeholder]').forEach(el => el.placeholder = this.getText(el.getAttribute('data-i18n-key-placeholder')));
        document.querySelectorAll('[data-i18n-key-title]').forEach(el => el.title = this.getText(el.getAttribute('data-i18n-key-title')));
        
        this.renderAlarmList();
        this.renderSoundList();
        this.renderPersonalStats();
        this.updatePomodoroDisplay();
        this.renderTipsList();

        document.getElementById('current-lang-text').textContent = lang.toUpperCase();
        this.db.settings.put({ key: 'language', value: lang });
    },

    initDatabase: function() {
        this.db = new Dexie('TheCozyWebDB');
        this.db.version(11).stores({
            alarms: '++id, time',
            userSounds: '++id, name, icon, isFavorite, type, youtubeId',
            tips: '++id, &content',
            settings: 'key, value'
        });
    },

    initUI: function() {
        this.swiper = new Swiper('.swiper-container-vertical', { 
            direction: 'vertical', 
            slidesPerView: 1, 
            spaceBetween: 0, 
            allowTouchMove: false 
        });
        this.updatePomodoroDisplay();
    },

    initEventListeners: function() {
        // --- Language Switcher ---
        const langButton = document.getElementById('language-switcher-button');
        const langOptions = document.getElementById('language-options');
        langButton.addEventListener('click', () => langOptions.classList.toggle('hidden'));
        document.addEventListener('click', (e) => {
            if (!langButton.contains(e.target) && !langOptions.contains(e.target)) {
                langOptions.classList.add('hidden');
            }
        });
        document.querySelectorAll('.lang-option').forEach(option => option.addEventListener('click', (e) => {
            e.preventDefault();
            this.setLanguage(e.target.dataset.lang);
            langOptions.classList.add('hidden');
        }));

        // --- Main UI Interactions ---
        document.getElementById('mobile-menu-button').addEventListener('click', () => document.getElementById('mobile-menu').classList.toggle('show'));
        document.getElementById('open-sidebar-cta').addEventListener('click', () => document.body.classList.add('sidebar-active'));
        document.addEventListener('click', (e) => {
            const sidebar = document.querySelector('.sidebar-container');
            if (document.body.classList.contains('sidebar-active') && !sidebar.contains(e.target) && !e.target.closest('#open-sidebar-cta')) {
                 document.body.classList.remove('sidebar-active');
            }
        });
        document.getElementById('theme-selector').addEventListener('click', (e) => {
            const themeCard = e.target.closest('.theme-card');
            if (themeCard) this.handleThemeSelection(themeCard.dataset.theme);
        });
        
        // --- Forms ---
        document.getElementById('alarm-form').addEventListener('submit', (e) => this.handleAlarmFormSubmit(e));
        document.getElementById('contact-form').addEventListener('submit', (e) => this.handleContactFormSubmit(e));
        document.getElementById('ai-form').addEventListener('submit', (e) => this.handleAIChat(e));
        document.getElementById('youtube-link-form').addEventListener('submit', (e) => this.saveYouTubeLink(e));

        // --- Lists & Grids ---
        document.getElementById('alarm-list').addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.delete-alarm-btn');
            if(deleteBtn) this.deleteAlarm(parseInt(deleteBtn.dataset.id));
        });
        document.getElementById('sound-list').addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.delete-sound-btn');
            if(deleteBtn) this.deleteUserSound(parseInt(deleteBtn.dataset.id));
        });
        
        // --- Sidebar & Modals ---
        document.querySelectorAll('.tab-nav-button').forEach(button => button.addEventListener('click', () => this.swiper.slideTo(parseInt(button.dataset.slide), 300)));
        this.swiper.on('slideChange', () => {
            document.querySelectorAll('.tab-nav-button').forEach(btn => btn.classList.remove('active'));
            document.querySelector(`.tab-nav-button[data-slide="${this.swiper.activeIndex}"]`).classList.add('active');
        });
        
        document.getElementById('dismiss-alarm-btn').addEventListener('click', () => {
            document.getElementById('alarm-fired-modal').classList.add('hidden');
            const player = document.getElementById('alarm-audio-player');
            player.pause();
            if (player.src && player.src.startsWith('blob:')) {
                URL.revokeObjectURL(player.src);
            }
            player.src = ''; 
            player.loop = false; 

            if (this.ytPlayer && this.ytPlayer.stopVideo) this.ytPlayer.stopVideo();
            document.getElementById('youtube-player-wrapper').classList.add('hidden');
        });
        
        document.getElementById('dismiss-pomodoro-btn').addEventListener('click', () => {
            document.getElementById('pomodoro-end-modal').classList.add('hidden');
            const player = document.getElementById('alarm-audio-player');
            player.pause();
             if (player.src && player.src.startsWith('blob:')) {
                URL.revokeObjectURL(player.src);
            }
            player.src = '';
            player.loop = false;
            
            if (this.ytPlayer && this.ytPlayer.stopVideo) this.ytPlayer.stopVideo();
            document.getElementById('youtube-player-wrapper').classList.add('hidden');

            if (this.pomodoroMode === 'pomodoro') {
                this.pomodoro.sessions++;
                this.switchPomodoroMode(this.pomodoro.sessions % 4 === 0 ? 'longBreak' : 'shortBreak');
            } else {
                this.switchPomodoroMode('pomodoro');
            }
        });


        document.querySelectorAll('[data-modal-close]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById(btn.dataset.modalClose).classList.add('hidden');
            });
        });
        document.getElementById('open-add-sound-choice-modal').addEventListener('click', () => document.getElementById('add-sound-choice-modal').classList.remove('hidden'));
        document.getElementById('add-sound-upload-btn').addEventListener('click', () => this.handleSoundUpload());
        document.getElementById('add-sound-youtube-btn').addEventListener('click', () => {
            document.getElementById('add-sound-choice-modal').classList.add('hidden');
            document.getElementById('add-youtube-modal').classList.remove('hidden');
        });
        
        // --- Pomodoro ---
        document.querySelectorAll('.pomodoro-mode-btn').forEach(btn => btn.addEventListener('click', () => this.switchPomodoroMode(btn.dataset.mode)));
        document.getElementById('pomodoro-control-btn').addEventListener('click', () => this.pomodoroInterval ? this.pausePomodoro() : this.startPomodoro());
        document.getElementById('pomodoro-reset-btn').addEventListener('click', () => this.switchPomodoroMode(this.pomodoroMode));
        
        // --- Breathing Exercise ---
        document.getElementById('breathing-toggle-btn').addEventListener('click', () => this.toggleBreathingExercise());
        
        // --- Edit Sounds Modals ---
        document.getElementById('edit-sound-form').addEventListener('submit', (e) => this.saveEditedSound(e));

        // --- YouTube Player ---
        document.getElementById('close-youtube-player').addEventListener('click', () => {
             document.getElementById('youtube-player-wrapper').classList.add('hidden');
             if(this.ytPlayer && this.ytPlayer.stopVideo) this.ytPlayer.stopVideo();
        });
    },

    initWorker: function() {
        const workerCode = `
            let timeouts = {}; 
            self.onmessage = function(e) { 
                const { type, alarm } = e.data; 
                if (type === 'SET_ALARM') { 
                    if (alarm.time - Date.now() > 0) { 
                        timeouts[alarm.id] = setTimeout(() => { 
                            self.postMessage({ type: 'ALARM_FIRED', alarm: alarm }); 
                            delete timeouts[alarm.id]; 
                        }, alarm.time - Date.now()); 
                    } 
                } else if (type === 'CANCEL_ALARM') { 
                    if (timeouts[alarm.id]) { 
                        clearTimeout(timeouts[alarm.id]); 
                        delete timeouts[alarm.id]; 
                    } 
                } 
            };`;
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        this.alarmWorker = new Worker(URL.createObjectURL(blob));
        this.alarmWorker.onmessage = (e) => {
            if (e.data.type === 'ALARM_FIRED') {
                this.triggerWakeUpAlarm(e.data.alarm.id);
            }
        };
    },

    loadSavedData: async function() {
        await this.db.open();
        const [savedMode, savedTheme, savedLang] = await Promise.all([
            this.db.settings.get('themeMode'),
            this.db.settings.get('lastManualTheme'),
            this.db.settings.get('language')
        ]);
        this.themeMode = savedMode?.value || 'auto';
        this.lastManualTheme = savedTheme?.value || 'theme-default';
        const browserLang = navigator.language.split('-')[0];
        const langToSet = savedLang?.value || (translations[browserLang] ? browserLang : 'vi');
        this.setLanguage(langToSet);
        this.applyThemeBasedOnMode();
    },

    handleAIChat: async function(e) {
        e.preventDefault();
        if (!this.geminiAPIKey || this.geminiAPIKey === 'YOUR_GEMINI_API_KEY') {
            this.addMessageToChat(this.getText('ai_key_error'), 'ai');
            return;
        }

        const input = document.getElementById('ai-input');
        const sendBtn = document.getElementById('ai-send-btn');
        const userInput = input.value.trim();
        if (!userInput) return;

        this.addMessageToChat(userInput, 'user');
        input.value = '';
        input.disabled = true;
        sendBtn.disabled = true;
        document.getElementById('ai-loading').classList.remove('hidden');

        try {
            const responseText = await this.callAIAssistant(userInput);
            this.handleAIResponse(responseText);
        } catch (error) {
            console.error("AI Assistant Error:", error);
            this.addMessageToChat(this.getText('ai_error_generic') || 'An error occurred.', 'ai');
        } finally {
            input.disabled = false;
            sendBtn.disabled = false;
            document.getElementById('ai-loading').classList.add('hidden');
            input.focus();
        }
    },
    
    addMessageToChat: function(message, sender) {
        const chatBox = document.getElementById('ai-chat-box');
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('ai-message', sender);
        messageDiv.innerHTML = message.replace(/\n/g, '<br>');
        chatBox.appendChild(messageDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    },
    
    callAIAssistant: async function(userInput) {
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${this.geminiAPIKey}`;
        const langMap = { vi: 'Vietnamese', en: 'English', ja: 'Japanese' };

        const systemPrompt = `You are Cozy AI, a warm, empathetic expert on sleep and relaxation. Respond ONLY in ${langMap[this.currentLanguage]}. Your role is to provide science-based advice and calming guidance. Politely decline any requests to set alarms or perform actions, explaining your purpose is to offer knowledge. Keep your tone friendly and use simple formatting.`;

        const payload = {
            contents: [{ parts: [{ text: userInput }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
        };

        const response = await fetch(apiUrl, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload) 
        });

        if (!response.ok) throw new Error(`API request failed with status ${response.status}`);
        
        const result = await response.json();
        return result.candidates?.[0]?.content?.parts?.[0]?.text || "";
    },

    handleAIResponse: function(responseText) {
        if (!responseText) { 
            this.addMessageToChat(this.getText('ai_understanding_error'), 'ai'); 
            return; 
        }
        this.addMessageToChat(responseText, 'ai');
    },
    
    initDateTimePickers: function() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('alarm-date-input').min = today;
        
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        document.getElementById('alarm-time-input').value = currentTime;
    },

    handleAlarmFormSubmit: async function(e) {
        e.preventDefault();
        const form = e.target;
        
        const date = document.getElementById('alarm-date-input').value;
        const time = document.getElementById('alarm-time-input').value;
        
        if (!date || !time) {
            alert(this.getText('alarm_form_error_datetime'));
            return;
        }
        
        const alarmDateTime = new Date(`${date}T${time}`);
        const alarmTime = alarmDateTime.getTime();
        
        if (alarmTime <= Date.now()) {
            alert(this.getText('alarm_form_error_future'));
            return;
        }
        
        const alarm = {
            time: alarmTime,
            label: form.querySelector('#alarm-label').value,
            soundId: form.querySelector('#alarm-sound').value,
            isRepeating: form.querySelector('#alarm-repeat').checked
        };
        
        const id = await this.db.alarms.add(alarm);
        this.alarmWorker.postMessage({ type: 'SET_ALARM', alarm: { ...alarm, id } });
        
        form.reset();
        this.initDateTimePickers();
        
        this.renderAlarmList();
        
        const saveBtn = document.getElementById('save-alarm-btn');
        const originalText = saveBtn.textContent;
        saveBtn.innerHTML = `<i class="fas fa-check"></i> ${this.getText('alarm_form_saved')}`;
        setTimeout(() => { saveBtn.textContent = originalText; }, 2000);
        
        this.swiper.slideTo(1, 300);
    },

    handleContactFormSubmit: function(e) {
        e.preventDefault();
        const name = e.target.name.value;
        const email = e.target.email.value;
        const message = e.target.message.value;
        const subject = encodeURIComponent(`Message from ${name} via The Cozy Web`);
        const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`);
        window.location.href = `mailto:csebacksqace@gmail.com?subject=${subject}&body=${body}`;
        e.target.reset();
    },

    createStars: function() {
        if (document.querySelector('.star')) return;
        const bg = document.getElementById('dynamic-bg');
        let stars = '';
        const starTypes = ['warm', 'cool', 'bright'];
        for (let i = 0; i < 80; i++) {
            const size = Math.random() * 4 + 1;
            const top = Math.random() * 100;
            const left = Math.random() * 100;
            const delay = Math.random() * 5;
            const dur = Math.random() * 4 + 1.5;
            const type = starTypes[Math.floor(Math.random() * starTypes.length)];
            const opacity = Math.random() * 0.8 + 0.2;
            stars += `<div class="star ${type}" style="width:${size}px; height:${size}px; top:${top}%; left:${left}%; animation-delay:${delay}s; --twinkle-duration:${dur}s; opacity: ${opacity}"></div>`;
        }
        const weatherLayer = document.getElementById('weather-layer');
        if (weatherLayer) {
            weatherLayer.insertAdjacentHTML('beforebegin', stars);
        } else {
            bg.insertAdjacentHTML('beforeend', stars);
        }
    },

    initWeatherSystem: function() {
        this.refreshWeather(new Date(), true);
        if (this.weatherTimer) clearInterval(this.weatherTimer);
        this.weatherTimer = setInterval(() => this.refreshWeather(new Date()), 60000);
    },

    refreshWeather: function(now, force = false) {
        const currentTime = now || new Date();
        const dateKey = this.getDateKey(currentTime);
        if (!this.weatherState || this.weatherState.dateKey !== dateKey || force) {
            this.weatherState = this.buildDailyWeather(currentTime);
            this.applyWeatherState(currentTime);
            this.updateMoonPhase();
            return;
        }
        this.updateWeatherLighting(currentTime);
        this.updateCelestialPositions(currentTime);
    },

    getDateKey: function(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    createSeededRandom: function(seedStr) {
        let hash = 2166136261;
        for (let i = 0; i < seedStr.length; i++) {
            hash ^= seedStr.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        let seed = hash >>> 0;
        return function() {
            seed += 0x6D2B79F5;
            let t = seed;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    },

    chooseWeighted: function(rng, weights) {
        const entries = Object.entries(weights);
        const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
        let roll = rng() * total;
        for (const [key, weight] of entries) {
            roll -= weight;
            if (roll <= 0) return key;
        }
        return entries[entries.length - 1][0];
    },

    buildDailyWeather: function(date) {
        const dateKey = this.getDateKey(date);
        const rng = this.createSeededRandom(dateKey);
        const month = date.getMonth() + 1;

        let weights = { clear: 0.35, partly: 0.25, overcast: 0.2, rain: 0.15, snow: 0.05 };
        if (month === 12 || month <= 2) {
            weights = { clear: 0.15, partly: 0.2, overcast: 0.25, rain: 0.2, snow: 0.2 };
        } else if (month >= 3 && month <= 5) {
            weights = { clear: 0.25, partly: 0.25, overcast: 0.2, rain: 0.25, snow: 0.05 };
        } else if (month >= 6 && month <= 8) {
            weights = { clear: 0.45, partly: 0.25, overcast: 0.15, rain: 0.15, snow: 0 };
        } else if (month >= 9 && month <= 11) {
            weights = { clear: 0.25, partly: 0.25, overcast: 0.25, rain: 0.2, snow: 0.05 };
        }

        const type = this.chooseWeighted(rng, weights);
        let intensity = 0.3;
        let cloudDensity = 0.2;
        let gloom = 0.1;
        let precipitation = null;

        if (type === 'clear') {
            intensity = 0.2 + rng() * 0.2;
            cloudDensity = 0.15 + rng() * 0.1;
            gloom = 0.05;
        } else if (type === 'partly') {
            intensity = 0.3 + rng() * 0.3;
            cloudDensity = 0.35 + rng() * 0.3;
            gloom = 0.15;
        } else if (type === 'overcast') {
            intensity = 0.5 + rng() * 0.2;
            cloudDensity = 0.75 + rng() * 0.2;
            gloom = 0.4 + rng() * 0.1;
        } else if (type === 'rain') {
            intensity = 0.6 + rng() * 0.35;
            cloudDensity = 0.85 + rng() * 0.1;
            gloom = 0.55 + rng() * 0.1;
            precipitation = 'rain';
        } else if (type === 'snow') {
            intensity = 0.45 + rng() * 0.35;
            cloudDensity = 0.65 + rng() * 0.2;
            gloom = 0.35 + rng() * 0.1;
            precipitation = 'snow';
        }

        return { dateKey, type, intensity, cloudDensity, gloom, precipitation };
    },

    applyWeatherState: function(now) {
        if (!this.weatherState) return;
        const currentTime = now || new Date();
        const body = document.body;
        body.classList.remove('weather-clear', 'weather-partly', 'weather-overcast', 'weather-rain', 'weather-snow');
        body.classList.add(`weather-${this.weatherState.type}`);

        this.updateWeatherLighting(currentTime);
        this.updateCloudElements(this.weatherState.cloudDensity);
        this.updatePrecipitation(this.weatherState.precipitation, this.weatherState.intensity);
        this.updateCelestialPositions(currentTime);
    },

    updateWeatherLighting: function(now) {
        if (!this.weatherState) return;
        const mistLayer = document.getElementById('mist-layer');
        if (!mistLayer) return;
        const isDay = this.getDayFlagForWeather(now || new Date());
        const nightBoost = isDay ? 0 : 0.08;
        const opacity = Math.min(0.75, (this.weatherState.gloom || 0) + nightBoost);
        mistLayer.style.opacity = opacity.toFixed(2);
    },

    getDayFlagForWeather: function(now) {
        if (this.themeMode !== 'auto' && this.lastAppliedTheme) {
            return this.lastAppliedTheme === 'theme-dawn' || this.lastAppliedTheme === 'theme-beach';
        }
        const hours = now.getHours() + now.getMinutes() / 60;
        return hours >= 6 && hours < 18;
    },

    updateCloudElements: function(density) {
        const layer = document.getElementById('cloud-layer');
        if (!layer) return;
        const safeDensity = Math.max(0, Math.min(1, density || 0));
        const count = safeDensity < 0.08 ? 0 : Math.round(8 + safeDensity * 18);

        if (count === 0) {
            layer.innerHTML = '';
            this.lastCloudCount = 0;
            return;
        }
        if (this.lastCloudCount === count) return;
        this.lastCloudCount = count;

        let clouds = '';
        for (let i = 0; i < count; i++) {
            const scale = Math.random() * 1.5 + 0.5;
            const top = Math.random() * 55 + 2;
            const duration = Math.random() * 80 + 40;
            const delay = Math.random() * -120;
            const width = Math.random() * 110 + 60;
            const animName = ['drift-slow', 'drift', 'drift-fast'][Math.floor(Math.random() * 3)];
            const opacity = Math.min(0.85, 0.25 + (safeDensity * 0.6) + (Math.random() * 0.15));
            clouds += `<div class="cloud" style="top:${top}%; transform: scale(${scale}); animation-name:${animName}; animation-duration:${duration}s; animation-delay:${delay}s; width:${width}px; height:${width * 0.3}px; opacity:${opacity};"></div>`;
        }
        layer.innerHTML = clouds;
    },

    updatePrecipitation: function(type, intensity) {
        const rainLayer = document.getElementById('rain-layer');
        const snowLayer = document.getElementById('snow-layer');

        if (type !== 'rain' && rainLayer) rainLayer.innerHTML = '';
        if (type !== 'snow' && snowLayer) snowLayer.innerHTML = '';

        if (type === 'rain') this.renderRaindrops(intensity);
        if (type === 'snow') this.renderSnowflakes(intensity);
    },

    renderRaindrops: function(intensity) {
        const layer = document.getElementById('rain-layer');
        if (!layer) return;
        const density = Math.max(0.3, Math.min(1, intensity || 0.6));
        const count = Math.round(50 + density * 100);
        let drops = '';
        for (let i = 0; i < count; i++) {
            const left = Math.random() * 100;
            const delay = Math.random() * -2.5;
            const speed = (0.7 + Math.random() * 0.6) / density;
            const opacity = 0.3 + Math.random() * 0.6;
            const height = 10 + Math.random() * 18;
            drops += `<div class="raindrop" style="left:${left}%; height:${height}px; animation-delay:${delay}s; --rain-speed:${speed.toFixed(2)}s; --rain-opacity:${opacity.toFixed(2)}"></div>`;
        }
        layer.innerHTML = drops;
    },

    renderSnowflakes: function(intensity) {
        const layer = document.getElementById('snow-layer');
        if (!layer) return;
        const density = Math.max(0.25, Math.min(1, intensity || 0.5));
        const count = Math.round(40 + density * 80);
        let flakes = '';
        for (let i = 0; i < count; i++) {
            const left = Math.random() * 100;
            const delay = Math.random() * -6;
            const speed = (4 + Math.random() * 4) / density;
            const size = 3 + Math.random() * 5;
            const opacity = 0.5 + Math.random() * 0.4;
            flakes += `<div class="snowflake" style="left:${left}%; animation-delay:${delay}s; --snow-speed:${speed.toFixed(2)}s; --snow-size:${size.toFixed(1)}px; --snow-opacity:${opacity.toFixed(2)}"></div>`;
        }
        layer.innerHTML = flakes;
    },

    updateCelestialPositions: function(now) {
        const current = now || new Date();
        const sun = document.getElementById('sun');
        const moon = document.getElementById('moon');
        if (!sun && !moon) return;
        const hours = current.getHours() + current.getMinutes() / 60;

        let dayProgress = (hours - 6) / 12;
        dayProgress = Math.max(0, Math.min(1, dayProgress));
        const sunX = 10 + dayProgress * 80;
        const sunY = 70 - (Math.sin(dayProgress * Math.PI) * 50);
        if (sun) {
            sun.style.left = `${sunX}%`;
            sun.style.top = `${sunY}%`;
        }

        let nightHour = hours < 6 ? hours + 24 : hours;
        let nightProgress = (nightHour - 18) / 12;
        nightProgress = Math.max(0, Math.min(1, nightProgress));
        const moonX = 90 - nightProgress * 80;
        const moonY = 70 - (Math.sin(nightProgress * Math.PI) * 45);
        if (moon) {
            moon.style.left = `${moonX}%`;
            moon.style.top = `${moonY}%`;
            moon.style.right = 'auto';
        }
    },

    createShootingStar: function() {
        const star = document.createElement('div');
        star.className = 'shooting-star';
        star.style.top = `${Math.random() * 80}%`;
        star.style.left = `${Math.random() * 100}%`;
        document.getElementById('dynamic-bg').appendChild(star);
        setTimeout(() => star.remove(), 2000);
    },

    updateMoonPhase: function() {
        const now = new Date();
        const year = now.getFullYear(), month = now.getMonth() + 1, day = now.getDate();
        let c = 0, e = 0, jd = 0, b = 0;
        if (month < 3) { c = year - 1; e = month + 12; } else { c = year; e = month; }
        jd = Math.floor(365.25 * c) + Math.floor(30.6 * (e + 1)) + day + 1720994.5;
        b = (jd - 2451550.1) / 29.530588853;
        b = b - Math.floor(b);
        let transform = '';
        if (b < 0.125) transform = 'translateX(0%)';
        else if (b < 0.25) transform = 'translateX(-75%)';
        else if (b < 0.375) transform = 'translateX(-50%)';
        else if (b < 0.5) transform = 'translateX(-25%)';
        else if (b < 0.625) transform = 'translateX(-100%)';
        else if (b < 0.75) transform = 'translateX(25%)';
        else if (b < 0.875) transform = 'translateX(50%)';
        else transform = 'translateX(75%)';
        document.querySelector('.moon-phase-overlay').style.transform = transform;
    },

    updatePomodoroDisplay: function() {
        const minutes = String(Math.floor(this.pomodoroRemainingTime / 60)).padStart(2, '0');
        const seconds = String(this.pomodoroRemainingTime % 60).padStart(2, '0');
        document.getElementById('pomodoro-timer').textContent = `${minutes}:${seconds}`;
        const controlBtn = document.getElementById('pomodoro-control-btn');
        controlBtn.textContent = this.pomodoroInterval ? this.getText('pomodoro_pause_btn') : this.getText('pomodoro_start_btn');
    },

    switchPomodoroMode: function(mode) {
        this.pausePomodoro();
        this.pomodoroMode = mode;
        this.pomodoroRemainingTime = this.pomodoro[mode] * 60;
        document.querySelectorAll('.pomodoro-mode-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));
        this.updatePomodoroDisplay();
    },

    startPomodoro: function() {
        if(this.pomodoroInterval) return;
        this.updatePomodoroDisplay();
        this.pomodoroInterval = setInterval(() => {
            this.pomodoroRemainingTime--;
            this.updatePomodoroDisplay();
            if (this.pomodoroRemainingTime <= 0) {
                clearInterval(this.pomodoroInterval);
                this.pomodoroInterval = null;
                this.triggerPomodoroEnd(this.pomodoroMode);
            }
        }, 1000);
    },

    pausePomodoro: function() {
        clearInterval(this.pomodoroInterval);
        this.pomodoroInterval = null;
        this.updatePomodoroDisplay();
    },
    
    triggerPomodoroEnd: async function(endedMode) {
        const player = document.getElementById('alarm-audio-player');
        player.loop = true;

        const playSound = (url) => {
            if (!url) return;
            player.src = url;
            player.load();
            player.play().catch(console.error);
        };
        
        const favoriteSound = await this.db.userSounds.where('isFavorite').equals(true).first();
        if (favoriteSound) {
            if (favoriteSound.type === 'upload' && favoriteSound.data) {
                playSound(URL.createObjectURL(favoriteSound.data));
            } else if (favoriteSound.type === 'youtube' && favoriteSound.youtubeId) {
                document.getElementById('youtube-player-wrapper').classList.remove('hidden');
                this.ytPlayer.loadVideoById(favoriteSound.youtubeId);
                this.ytPlayer.playVideo();
            } else { 
                playSound(this.ambientSoundFiles.rain.url);
            }
        } else { 
            playSound(this.ambientSoundFiles.rain.url);
        }

        // --- MODIFIED: Use key to get translated tip ---
        const tipKey = this.defaultTipKeys[Math.floor(Math.random() * this.defaultTipKeys.length)];
        const tipContent = this.getText(tipKey);

        document.getElementById('pomodoro-tip-content').textContent = tipContent;
        if (tipContent) {
            try {
                await this.db.tips.put({ content: tipContent });
                this.renderTipsList();
            } catch (e) {
                if (e.name !== 'ConstraintError') console.error("Error saving tip:", e);
            }
        }

        const subtitleKey = endedMode === 'pomodoro' ? 'pomodoro_end_subtitle_pomo' : 'pomodoro_end_subtitle_break';
        document.getElementById('pomodoro-end-subtitle').textContent = this.getText(subtitleKey);
        
        document.getElementById('pomodoro-end-modal').classList.remove('hidden');
    },

    deleteAlarm: async function(id) {
        this.alarmWorker.postMessage({ type: 'CANCEL_ALARM', alarm: { id } });
        await this.db.alarms.delete(id);
        this.renderAlarmList();
    },
    
    triggerWakeUpAlarm: async function(id) {
        const alarm = await this.db.alarms.get(id);
        if (!alarm) return;

        const player = document.getElementById('alarm-audio-player');
        player.loop = true; 
        const soundId = alarm.soundId;
        const defaultSoundURL = 'https://assets.mixkit.co/sfx/preview/mixkit-alarm-digital-bleep-991.mp3';

        const playSound = (url) => {
            if (!url) return;
            player.src = url;
            player.load(); 
            const playPromise = player.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.error(`Error playing alarm sound (this is common due to browser autoplay policies): ${error}`);
                });
            }
        };

        try {
            if (soundId && soundId.startsWith('default-')) {
                const soundKey = soundId.replace('default-', '');
                playSound(this.ambientSoundFiles[soundKey]?.url || defaultSoundURL);
            } else if (soundId && soundId.startsWith('user-')) {
                const userSound = await this.db.userSounds.get(parseInt(soundId.replace('user-', '')));
                if (userSound) { 
                    if (userSound.type === 'upload' && userSound.data) {
                        playSound(URL.createObjectURL(userSound.data));
                    } else if (userSound.type === 'youtube' && userSound.youtubeId) {
                        document.getElementById('youtube-player-wrapper').classList.remove('hidden');
                        this.ytPlayer.loadVideoById(userSound.youtubeId);
                        this.ytPlayer.playVideo();
                    } else {
                        playSound(defaultSoundURL); 
                    }
                } else {
                    playSound(defaultSoundURL);
                }
            } else {
                playSound(defaultSoundURL);
            }
        } catch (error) {
            console.error("A critical error occurred while trying to play alarm sound:", error);
            playSound(defaultSoundURL);
        }

        document.getElementById('fired-alarm-label').textContent = alarm.label || this.getText('alarm_fired_subtitle');
        
        // --- MODIFIED: Use key to get translated tip ---
        const tipKey = this.defaultTipKeys[Math.floor(Math.random() * this.defaultTipKeys.length)];
        const tipContent = this.getText(tipKey);

        document.getElementById('tip-content').textContent = tipContent;

        if (tipContent) {
            try {
                await this.db.tips.put({ content: tipContent }); 
                this.renderTipsList();
            } catch (e) {
                if (e.name !== 'ConstraintError') {
                    console.error("Error saving tip:", e);
                }
            }
        }
        
        document.getElementById('alarm-fired-modal').classList.remove('hidden');

        if (alarm.isRepeating) {
            this.rescheduleRepeatingAlarm(alarm);
        } else {
            await this.db.alarms.delete(id);
        }
        this.renderAlarmList();
    },

    rescheduleRepeatingAlarm: async function(alarm) {
        const nextAlarmTime = new Date(alarm.time);
        nextAlarmTime.setDate(nextAlarmTime.getDate() + 1);
        const newAlarm = { ...alarm, time: nextAlarmTime.getTime() };
        await this.db.alarms.put(newAlarm);
        this.alarmWorker.postMessage({ type: 'SET_ALARM', alarm: newAlarm });
    },

    renderAlarmList: async function() {
        const alarms = await this.db.alarms.orderBy("time").toArray();
        const listEl = document.getElementById("alarm-list");
        if (alarms.length === 0) {
            listEl.innerHTML = `<p class="text-gray-400 text-center">${this.getText('alarm_list_empty')}</p>`;
            return;
        }
        const locale = this.currentLanguage === 'ja' ? 'ja-JP' : this.currentLanguage === 'en' ? 'en-US' : 'vi-VN';
        
        listEl.innerHTML = alarms.map(alarm => {
            const date = new Date(alarm.time);
            const repeatIcon = alarm.isRepeating ? `<span class="ml-2" title="${this.getText('alarm_list_repeats')}"><i class="fas fa-sync-alt h-4 w-4 inline text-cyan-300"></i></span>` : '';
            
            const formattedDate = date.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
            const formattedTime = date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });

            return `<div class="bg-gray-700/50 p-3 rounded-lg flex justify-between items-center">
                        <div>
                            <p class="font-bold truncate">${alarm.label || this.getText('alarm_list_default_label')}${repeatIcon}</p>
                            <p class="text-sm text-gray-400">${formattedDate} - ${formattedTime}</p>
                        </div>
                        <button data-id="${alarm.id}" class="delete-alarm-btn text-red-400 hover:text-red-500 font-bold p-2">${this.getText('alarm_list_delete')}</button>
                    </div>`;
        }).join('');
    },
    
    renderTipsList: async function() {
        const tips = await this.db.tips.toArray();
        const listEl = document.getElementById('tips-list');
        listEl.innerHTML = tips.length === 0 ? `<p class="text-gray-400 text-center">${this.getText('tips_list_empty')}</p>` :
            tips.map(tip => `<div class="bg-gray-700/50 p-3 rounded-lg">${tip.content}</div>`).join('');
    },

    renderSoundList: async function() {
        const userSounds = await this.db.userSounds.toArray();
        const listEl = document.getElementById('sound-list');
        listEl.innerHTML = userSounds.length === 0 ? `<p class="text-gray-400 text-center">${this.getText('sound_list_empty')}</p>` :
            userSounds.map(s => {
                const icon = s.type === 'youtube' ? 'fab fa-youtube text-red-500' : (s.icon || 'fas fa-music');
                return `<div class="bg-gray-700/50 p-3 rounded-lg flex justify-between items-center">
                            <span class="truncate w-48 flex items-center"><i class="${icon} fa-fw mr-2"></i>${s.name}</span>
                            <button data-id="${s.id}" class="delete-sound-btn text-red-400 hover:text-red-500 font-bold text-xs">${this.getText('alarm_list_delete')}</button>
                        </div>`;
            }).join('');
        
        let options = '';
        const favorites = userSounds.filter(s => s.isFavorite);
        const nonFavorites = userSounds.filter(s => !s.isFavorite);

        if (favorites.length > 0) {
            options += `<optgroup label="⭐ ${this.getText('sound_option_favorite')}">`;
            options += favorites.map(s => `<option value="user-${s.id}">${s.name}</option>`).join('');
            options += `</optgroup>`;
        }
        if (nonFavorites.length > 0) {
            options += `<optgroup label="${this.getText('sidebar_sounds_title')}">`;
            options += nonFavorites.map(s => `<option value="user-${s.id}">${s.name}</option>`).join('');
            options += `</optgroup>`;
        }
        options += `<optgroup label="Default Sounds">`;
        for (const [key, sound] of Object.entries(this.ambientSoundFiles)) {
            options += `<option value="default-${key}">${this.getText(sound.name_key)}</option>`;
        }
        options += `</optgroup>`;
        document.getElementById('alarm-sound').innerHTML = options;
    },

    // --- Stats Tracking ---
    initStats: async function() {
        let stats = await this.db.settings.get('userStats');
        if (!stats) {
            stats = { key: 'userStats', value: { totalChillingTime: 0, sessions: 0, soundPlays: {} } };
            await this.db.settings.put(stats);
        }
        stats.value.sessions++;
        await this.db.settings.put(stats);
        this.renderPersonalStats();
    },

    renderPersonalStats: async function() {
        const stats = await this.db.settings.get('userStats');
        if (!stats) return;
        const { totalChillingTime, sessions, soundPlays } = stats.value;
        const hours = Math.floor(totalChillingTime / 3600);
        const minutes = Math.floor((totalChillingTime % 3600) / 60);
        const seconds = totalChillingTime % 60;
        document.getElementById('personal-chilling-time').textContent = `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
        document.getElementById('personal-sessions').textContent = sessions.toLocaleString(this.currentLanguage);
        
        let favSound = this.getText('stats_no_favorite');
        let maxPlays = 0;
        for (const key in soundPlays) {
            if (soundPlays[key] > maxPlays) {
                maxPlays = soundPlays[key];
                if (key.startsWith('default-')) {
                    const soundInfo = this.ambientSoundFiles[key.replace('default-', '')];
                    favSound = soundInfo ? this.getText(soundInfo.name_key) : this.getText('stats_user_sound');
                } else {
                    const userSound = await this.db.userSounds.get(parseInt(key.replace('user-', '')));
                    favSound = userSound ? userSound.name : this.getText('stats_user_sound');
                }
            }
        }
        document.getElementById('personal-favorite-sound').textContent = favSound;
    },

    openEditSoundModal: function(sound) {
        this.currentEditingSound = sound;
        document.getElementById('edit-sound-id').value = sound.id;
        document.getElementById('edit-sound-name').value = sound.name;
        document.getElementById('edit-sound-icon').value = sound.icon;
        document.getElementById('edit-sound-modal').classList.remove('hidden');
    },

    saveEditedSound: async function(e) {
        e.preventDefault();
        const id = parseInt(document.getElementById('edit-sound-id').value);
        const name = document.getElementById('edit-sound-name').value;
        const icon = document.getElementById('edit-sound-icon').value;
        if (id && name) {
            await this.db.userSounds.update(id, { name, icon });
            document.getElementById('edit-sound-modal').classList.add('hidden');

            this.renderSoundList();
        }
    },

    toggleFavoriteStatus: async function(id, starElement) {
        const sound = await this.db.userSounds.get(id);
        if (sound) {
            const isFavorite = !sound.isFavorite;
            await this.db.userSounds.update(id, { isFavorite });
            starElement.classList.toggle('favorited', isFavorite);
            this.renderSoundList();
        }
    },

    deleteUserSound: async function(id) {
        await this.db.userSounds.delete(id);
        this.renderSoundList();
    },

    handleSoundUpload: function() {
        document.getElementById('add-sound-choice-modal').classList.add('hidden');
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'audio/*';
        input.onchange = async () => {
            const file = input.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = async (e) => {
                    try {
                        const soundData = { name: file.name.replace(/\.[^/.]+$/, ""), icon: '🎵', isFavorite: false, type: 'upload', data: new Blob([e.target.result], { type: file.type }) };
                        const id = await this.db.userSounds.add(soundData);
                        this.renderSoundList();
                        this.openEditSoundModal({ ...soundData, id });
                    } catch (err) { console.error("Error saving sound:", err); }
                };
                reader.readAsArrayBuffer(file);
            }
        };
        input.click();
    },
    
    extractYouTubeID: function(url) {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    },
    
    saveYouTubeLink: async function(e) {
        e.preventDefault();
        const input = document.getElementById('youtube-url-input');
        const errorEl = document.getElementById('youtube-error');
        const url = input.value.trim();
        const videoID = this.extractYouTubeID(url);

        if (!videoID) {
            errorEl.textContent = this.getText('add_yt_error_invalid');
            errorEl.classList.remove('hidden');
            return;
        }
        errorEl.classList.add('hidden');
        
        const soundData = { name: `YouTube - ${videoID}`, icon: 'fab fa-youtube', isFavorite: false, type: 'youtube', youtubeId: videoID };
        const id = await this.db.userSounds.add(soundData);
        this.renderSoundList();
        
        document.getElementById('add-youtube-modal').classList.add('hidden');
        input.value = '';
        this.openEditSoundModal({ ...soundData, id });
    },

    handleThemeSelection: function(selectedTheme) {
        this.themeMode = selectedTheme === 'theme-auto' ? 'auto' : 'manual';
        if (this.themeMode === 'manual') this.lastManualTheme = selectedTheme;
        this.applyThemeBasedOnMode();
        this.saveSettings();
    },

    applyThemeBasedOnMode: function() {
        let themeToApply;
        if (this.themeMode === 'auto') {
            const hour = new Date().getHours();
            if (hour >= 4 && hour < 8) themeToApply = 'theme-dawn';
            else if (hour >= 8 && hour < 16) themeToApply = 'theme-beach';
            else if (hour >= 16 && hour < 20) themeToApply = 'theme-sunset';
            else themeToApply = 'theme-default';
        } else {
            themeToApply = this.lastManualTheme;
        }
        if (themeToApply !== this.lastAppliedTheme) {
            this.applyTheme(themeToApply);
        }
    },

    applyTheme: function(themeName) {
        this.lastAppliedTheme = themeName;
        document.body.className = '';
        document.body.classList.add(themeName, 'loading');

        document.querySelectorAll('.theme-card').forEach(card => {
            const activeTheme = this.themeMode === 'auto' ? 'theme-auto' : this.lastManualTheme;
            card.classList.toggle('active', card.dataset.theme === activeTheme);
        });

        const isNightTheme = themeName === 'theme-default' || themeName === 'theme-sunset';
        if (isNightTheme) this.updateMoonPhase();
        this.updateCelestialPositions(new Date());
        this.updateNightEffects();
        if (this.weatherState) this.applyWeatherState(new Date());
        setTimeout(() => document.body.classList.remove('loading'), 10);
    },

    updateNightEffects: function() {
        if (this.shootingStarInterval) clearInterval(this.shootingStarInterval);
        const hour = new Date().getHours();
        const isNightTheme = this.lastAppliedTheme === 'theme-default' || this.lastAppliedTheme === 'theme-sunset';
        const isDeepNight = hour >= 23 || hour < 3;
        if (isNightTheme) {
            this.shootingStarInterval = setInterval(() => this.createShootingStar(), isDeepNight ? 3000 : 6000);
            document.body.classList.toggle('deep-night', isDeepNight);
        } else {
            document.body.classList.remove('deep-night');
        }
    },

    updateClockTick: 0,
    updateClock: function() {
        document.getElementById('clock').textContent = new Date().toLocaleTimeString(this.currentLanguage);
        this.updateClockTick++;
        if (this.updateClockTick % 30 === 0) {
            this.applyThemeBasedOnMode();
            this.refreshWeather(new Date());
        }
    },

    saveSettings: async function() {
        await this.db.settings.put({ key: 'themeMode', value: this.themeMode });
        await this.db.settings.put({ key: 'lastManualTheme', value: this.lastManualTheme });
    },

    // --- Breathing Exercise ---
    toggleBreathingExercise: function() {
        if (this.breathingActive) {
            this.stopBreathingExercise();
        } else {
            this.startBreathingCycle();
        }
    },

    startBreathingCycle: function() {
        if (this.breathingInterval) return;
        this.breathingActive = true;
        this.breathingPhase = 'inhale';
        this.breathingTime = this.breathingPattern.inhale;
        this.updateBreathingDisplay();
        const btn = document.getElementById('breathing-toggle-btn');
        btn.textContent = this.getText('breathing_stop_btn');
        btn.classList.add('active');

        this.breathingInterval = setInterval(() => {
            this.breathingTime--;
            this.updateBreathingDisplay();
            if (this.breathingTime <= 0) {
                if (this.breathingPhase === 'inhale') {
                    this.breathingPhase = 'hold';
                    this.breathingTime = this.breathingPattern.hold;
                } else if (this.breathingPhase === 'hold') {
                    this.breathingPhase = 'exhale';
                    this.breathingTime = this.breathingPattern.exhale;
                } else {
                    this.breathingPhase = 'inhale';
                    this.breathingTime = this.breathingPattern.inhale;
                }
                this.updateBreathingDisplay();
            }
        }, 1000);
    },

    stopBreathingExercise: function() {
        clearInterval(this.breathingInterval);
        this.breathingInterval = null;
        this.breathingActive = false;
        this.breathingPhase = 'inhale';
        this.breathingTime = this.breathingPattern.inhale;
        this.updateBreathingDisplay();
        const btn = document.getElementById('breathing-toggle-btn');
        btn.textContent = this.getText('breathing_start_btn');
        btn.classList.remove('active');
    },

    updateBreathingDisplay: function() {
        const circle = document.getElementById('breathing-circle');
        const inner = circle?.querySelector('.breathing-circle-inner');
        const phaseEl = document.getElementById('breathing-phase-text');
        const timerEl = document.getElementById('breathing-timer');

        if (phaseEl) {
            const phaseKey = this.breathingPhase === 'inhale' ? 'breathing_inhale' :
                             this.breathingPhase === 'hold' ? 'breathing_hold' : 'breathing_exhale';
            phaseEl.textContent = this.getText(phaseKey);
        }
        if (timerEl) timerEl.textContent = this.breathingTime;

        if (circle) {
            circle.classList.remove('phase-inhale', 'phase-hold', 'phase-exhale');
            circle.classList.add(`phase-${this.breathingPhase}`);
        }
        if (inner) {
            inner.classList.toggle('expand', this.breathingPhase === 'inhale' || this.breathingPhase === 'hold');
        }
    }
};

/**
 * Global function called by the YouTube IFrame API script when it's ready.
 */
function onYouTubeIframeAPIReady() {
    CozyWebApp.initYTPlayer();
}

// Start the application once the DOM is fully loaded.
document.addEventListener('DOMContentLoaded', () => CozyWebApp.init());

