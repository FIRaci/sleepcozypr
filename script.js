const CozyWebApp = {
    db: null,
    alarmWorker: null,
    swiper: null,
    chillingTimeTracker: null,
    themeMode: 'auto',
    lastManualTheme: 'theme-default',
    lastAppliedTheme: null,
    shootingStarInterval: null,
    currentEditingSound: null,
    activeSoundKey: null,
    currentLanguage: 'vi',
    geminiAPIKey: 'GEMINI_API_KEY',

    ambientSoundFiles: {
        rain: { name_key: 'sound_name_rain', icon: 'fas fa-cloud-showers-heavy', url: 'https://www.soundjay.com/nature/rain-04.mp3' },
        river: { name_key: 'sound_name_river', icon: 'fas fa-water', url: 'https://www.soundjay.com/nature/sounds/river-2.mp3' },
        lake: { name_key: 'sound_name_lake', icon: 'fas fa-wave-square', url: 'https://www.soundjay.com/nature/sounds/lake-waves-01.mp3' },
        wind: { name_key: 'sound_name_wind', icon: 'fas fa-wind', url: 'https://www.soundjay.com/nature/wind-1.mp3' },
        campfire: { name_key: 'sound_name_campfire', icon: 'fas fa-fire', url: 'https://www.soundjay.com/nature/campfire-1.mp3' },
        ocean: { name_key: 'sound_name_ocean', icon: 'fas fa-water', url: 'https://www.soundjay.com/nature/ocean-wave-1.mp3' },
    },

    pomodoro: { pomodoro: 25, shortBreak: 5, longBreak: 15, sessions: 0 },
    pomodoroInterval: null,
    pomodoroRemainingTime: 25 * 60,
    pomodoroMode: 'pomodoro',

    init: async function() {
        this.initDatabase();
        this.initUI();
        this.initEventListeners();
        this.initWorker();
        await this.loadSavedData();
        this.createStars();
        setInterval(() => this.updateClock(), 1000);
        this.initStats();
        setTimeout(() => { document.body.classList.remove('loading'); }, 100);
    },

    getText: function(key) {
        return translations[this.currentLanguage]?.[key] || translations['en']?.[key] || `[${key}]`;
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
        this.renderAmbientSoundGrid();
        this.renderPersonalStats();
        this.updatePlayerUI();
        this.updatePomodoroDisplay();

        document.getElementById('current-lang-text').textContent = lang.toUpperCase();
        this.db.settings.put({ key: 'language', value: lang });
    },

    initDatabase: function() {
        this.db = new Dexie('TheCozyWebDB');
        this.db.version(9).stores({
            alarms: '++id, time, managedByAI',
            userSounds: '++id, name, icon, isFavorite',
            tips: '++id, &content',
            settings: 'key, value'
        });
    },

    initUI: function() {
        this.swiper = new Swiper('.swiper-container-vertical', { direction: 'vertical', slidesPerView: 1, spaceBetween: 0, allowTouchMove: false });
        this.initTimePicker();
        this.updatePomodoroDisplay();
    },

    initEventListeners: function() {
        // Language Switcher
        const langButton = document.getElementById('language-switcher-button');
        const langOptions = document.getElementById('language-options');
        langButton.addEventListener('click', () => langOptions.classList.toggle('hidden'));
        document.addEventListener('click', (e) => !langButton.contains(e.target) && !langOptions.contains(e.target) && langOptions.classList.add('hidden'));
        document.querySelectorAll('.lang-option').forEach(option => option.addEventListener('click', (e) => {
            e.preventDefault();
            this.setLanguage(e.target.dataset.lang);
            langOptions.classList.add('hidden');
        }));

        // Other Listeners
        document.getElementById('mobile-menu-button').addEventListener('click', () => document.getElementById('mobile-menu').classList.toggle('show'));
        document.getElementById('open-sidebar-cta').addEventListener('click', () => document.body.classList.add('sidebar-active'));
        document.addEventListener('click', (e) => {
            const sidebar = document.querySelector('.sidebar-container');
            if (document.body.classList.contains('sidebar-active') && !sidebar.contains(e.target) && !document.getElementById('open-sidebar-cta').contains(e.target)) {
                document.body.classList.remove('sidebar-active');
            }
            if (!e.target.closest('.sound-options-btn')) {
                document.querySelectorAll('.sound-options-menu').forEach(menu => menu.style.display = 'none');
            }
        });
        document.getElementById('theme-selector').addEventListener('click', (e) => e.target.closest('.theme-card') && this.handleThemeSelection(e.target.closest('.theme-card').dataset.theme));
        document.getElementById('alarm-form').addEventListener('submit', (e) => this.handleAlarmFormSubmit(e));
        document.getElementById('contact-form').addEventListener('submit', (e) => this.handleContactFormSubmit(e));
        document.getElementById('alarm-list').addEventListener('click', (e) => e.target.closest('.delete-alarm-btn') && this.deleteAlarm(parseInt(e.target.closest('.delete-alarm-btn').dataset.id)));
        document.getElementById('sound-upload-main').addEventListener('change', (e) => this.handleSoundUpload(e, true));
        document.getElementById('sound-list').addEventListener('click', (e) => e.target.closest('.delete-sound-btn') && this.deleteUserSound(parseInt(e.target.closest('.delete-sound-btn').dataset.id)));
        document.getElementById('dismiss-alarm-btn').addEventListener('click', () => {
            document.getElementById('alarm-fired-modal').classList.add('hidden');
            document.getElementById('alarm-audio-player').pause();
        });
        document.querySelectorAll('.tab-nav-button').forEach(button => button.addEventListener('click', () => this.swiper.slideTo(parseInt(button.dataset.slide), 300)));
        this.swiper.on('slideChange', () => {
            document.querySelectorAll('.tab-nav-button').forEach(btn => btn.classList.remove('active'));
            document.querySelector(`.tab-nav-button[data-slide="${this.swiper.activeIndex}"]`).classList.add('active');
        });
        document.getElementById('ambient-sounds-grid').addEventListener('click', (e) => {
            const card = e.target.closest('.sound-card');
            const optionsBtn = e.target.closest('.sound-options-btn');
            const menu = e.target.closest('.sound-options-menu');
            if (optionsBtn) { e.stopPropagation(); this.toggleSoundOptionsMenu(optionsBtn); return; }
            if (menu) { e.stopPropagation(); this.handleSoundMenuAction(e.target); return; }
            if (card) card.id === 'add-sound-card' ? this.handleSoundUpload() : this.toggleAmbientSound(card.dataset.soundKey);
        });
        document.getElementById('player-play-pause-btn').addEventListener('click', () => this.toggleAmbientSoundPlayback());
        document.getElementById('player-volume-slider').addEventListener('input', (e) => document.getElementById('ambient-player').volume = e.target.value);
        document.getElementById('player-close-btn').addEventListener('click', () => this.hideAudioPlayer());
        const ambientPlayer = document.getElementById('ambient-player');
        ambientPlayer.onplay = () => this.updatePlayerUI();
        ambientPlayer.onpause = () => this.updatePlayerUI();
        document.querySelectorAll('.pomodoro-mode-btn').forEach(btn => btn.addEventListener('click', () => this.switchPomodoroMode(btn.dataset.mode)));
        document.getElementById('pomodoro-control-btn').addEventListener('click', () => this.pomodoroInterval ? this.pausePomodoro() : this.startPomodoro());
        document.getElementById('pomodoro-reset-btn').addEventListener('click', () => this.switchPomodoroMode(this.pomodoroMode));
        document.getElementById('edit-sound-form').addEventListener('submit', (e) => this.saveEditedSound(e));
        document.getElementById('cancel-edit-sound').addEventListener('click', () => this.closeEditSoundModal());
        document.getElementById('restore-sounds-btn').addEventListener('click', () => this.openRestoreSoundsModal());
        document.getElementById('close-restore-modal-btn').addEventListener('click', () => document.getElementById('restore-sounds-modal').classList.add('hidden'));
        document.getElementById('hidden-sounds-list').addEventListener('click', (e) => e.target.closest('.unhide-sound-btn') && this.unhideDefaultSound(e.target.closest('.unhide-sound-btn').dataset.soundKey));
        document.getElementById('ai-form').addEventListener('submit', (e) => this.handleAIChat(e));
    },

    initWorker: function() {
        const workerCode = `let timeouts = {}; self.onmessage = function(e) { const { type, alarm } = e.data; if (type === 'SET_ALARM') { if (alarm.time - Date.now() > 0) { timeouts[alarm.id] = setTimeout(() => { self.postMessage({ type: 'ALARM_FIRED', alarm: alarm }); delete timeouts[alarm.id]; }, alarm.time - Date.now()); } } else if (type === 'CANCEL_ALARM') { if (timeouts[alarm.id]) { clearTimeout(timeouts[alarm.id]); delete timeouts[alarm.id]; } } };`;
        this.alarmWorker = new Worker(URL.createObjectURL(new Blob([workerCode], { type: 'application/javascript' })));
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
        const langToSet = savedLang?.value || navigator.language.split('-')[0] || 'vi';
        this.setLanguage(translations[langToSet] ? langToSet : 'vi');
        this.applyThemeBasedOnMode();
    },

    handleAIChat: async function(e) {
        e.preventDefault();
        if (!this.geminiAPIKey || this.geminiAPIKey === 'YOUR_API_KEY_HERE') {
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
            const response = await this.callAIAssistant(userInput);
            this.handleAIResponse(response);
        } catch (error) {
            console.error("AI Assistant Error:", error);
            this.addMessageToChat(this.getText('ai_error'), 'ai');
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
        // Quay trở lại gọi trực tiếp API của Google
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${this.geminiAPIKey}`;
        
        const now = new Date();
        const locale = this.currentLanguage === 'ja' ? 'ja-JP' : this.currentLanguage === 'en' ? 'en-US' : 'vi-VN';
        const currentTimeString = now.toLocaleString(locale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowDateString = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
        const langMap = { vi: 'Vietnamese', en: 'English', ja: 'Japanese' };

        const systemPrompt = `You are Cozy AI, a master of sleep science. The current date/time is ${currentTimeString}. Your tasks: 1. Analyze user text to set sleep alarms. 2. Share practical tips. Rules: - ALWAYS respond in ${langMap[this.currentLanguage]}. - Always determine the absolute date (YYYY-MM-DD) from relative terms. - If intent is 'schedule', 'schedule_details' MUST contain at least one valid object. Example: If user says "đặt báo thức 10h tối mai", you must use ${tomorrowDateString} for the date. Your response MUST be valid JSON following the schema, with no extra text.`;

        const payload = {
            contents: [{ parts: [{ text: userInput }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: { "intent": { "type": "STRING", "enum": ["schedule", "provide_tip", "general"] }, "response_text": { "type": "STRING", "description": `Your friendly response in ${langMap[this.currentLanguage]}.` }, "schedule_details": { "type": "ARRAY", "items": { "type": "OBJECT", "properties": { "type": { "type": "STRING", "enum": ["normal", "exception"] }, "time": { "type": "STRING" }, "date": { "type": "STRING" }, "sound_request": { "type": "STRING" } }, "required": ["type", "time", "date"] } }, "tips": { "type": "ARRAY", "items": { "type": "STRING" } } }, "required": ["intent", "response_text"]
                }
            }
        };

        const response = await fetch(apiUrl, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload) 
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Google API request failed: ${errorText}`);
        }
        const result = await response.json();
        return JSON.parse(result.candidates[0].content.parts[0].text);
    },

    handleAIResponse: function(aiData) {
        if (!aiData || !aiData.response_text) { this.addMessageToChat(this.getText('ai_understanding_error'), 'ai'); return; }
        this.addMessageToChat(aiData.response_text, 'ai');
        if (aiData.tips?.length) this.addAITipsToLibrary(aiData.tips);
        if (aiData.intent === 'schedule' && aiData.schedule_details?.length) {
            this.processAISchedule(aiData.schedule_details);
            this.swiper.slideTo(1, 500);
        }
    },

    addAITipsToLibrary: async function(tips) {
        if (!tips || tips.length === 0) return;
        const existingTips = (await this.db.tips.toArray()).map(t => t.content);
        const newTips = tips.filter(tip => !existingTips.includes(tip));
        if (newTips.length > 0) {
            await this.db.tips.bulkAdd(newTips.map(content => ({ content })));
            this.renderTipsList();
        }
    },

    processAISchedule: async function(details) {
        await this.db.alarms.where({ managedByAI: true }).delete();
        for (const item of details) {
            if (!item.time || !item.date) continue;
            const soundId = await this.findBestSoundId(item.sound_request);
            const [hours, minutes] = item.time.split(':').map(Number);
            const [year, month, day] = item.date.split('-').map(Number);
            const alarmDate = new Date(year, month - 1, day, hours, minutes, 0);
            if (alarmDate.getTime() < Date.now()) continue;
            const alarm = { time: alarmDate.getTime(), label: `${this.getText('alarm_list_ai_managed')}`, soundId, isRepeating: item.type === 'normal', managedByAI: true };
            const id = await this.db.alarms.add(alarm);
            this.alarmWorker.postMessage({ type: 'SET_ALARM', alarm: { ...alarm, id } });
        }
        this.renderAlarmList();
    },

    findBestSoundId: async function(soundRequest) {
        if (!soundRequest || soundRequest === 'any') return 'default_alarm';
        for (const key in this.ambientSoundFiles) {
            if (this.getText(this.ambientSoundFiles[key].name_key).toLowerCase() === soundRequest.toLowerCase()) {
                return this.ambientSoundFiles[key].url;
            }
        }
        const favoriteSounds = await this.db.userSounds.where({ isFavorite: true }).toArray();
        if (favoriteSounds.length > 0) return favoriteSounds[0].id.toString();
        return 'default_alarm';
    },

    initTimePicker: function() {
        const timeInput = document.getElementById("custom-time-input");
        const popover = document.getElementById("time-picker-popover");
        if (!timeInput || !popover) return;
        timeInput.addEventListener('click', () => this.openTimePicker());
        popover.addEventListener('click', (e) => {
            if (e.target.classList.contains('time-picker-item')) {
                const column = e.target.parentElement;
                column.querySelector('.selected')?.classList.remove('selected');
                e.target.classList.add('selected');
                e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                this.updateTimeDisplay();
            }
        });
        document.addEventListener('mousedown', (e) => {
            if (!timeInput.contains(e.target) && !popover.contains(e.target)) {
                this.closeTimePicker();
            }
        });
    },

    openTimePicker: function() {
        const popover = document.getElementById("time-picker-popover");
        const timeInput = document.getElementById("custom-time-input");
        const rect = timeInput.getBoundingClientRect();
        popover.style.top = `${rect.bottom + 5}px`;
        popover.style.left = `${rect.left}px`;
        popover.style.width = `${rect.width}px`;
        this.populateTimePicker();
        popover.classList.remove('hidden');
    },

    closeTimePicker: function() {
        document.getElementById("time-picker-popover")?.classList.add('hidden');
    },

    populateTimePicker: function() {
        const hourCol = document.getElementById('hour-column');
        const minCol = document.getElementById('minute-column');
        const ampmCol = document.getElementById('ampm-column');
        let hours = '', minutes = '', ampm = '';
        for (let i = 1; i <= 12; i++) hours += `<div class="time-picker-item" data-value="${i}">${String(i).padStart(2, '0')}</div>`;
        for (let i = 0; i < 60; i++) minutes += `<div class="time-picker-item" data-value="${i}">${String(i).padStart(2, '0')}</div>`;
        ampm = `<div class="time-picker-item" data-value="AM">AM</div><div class="time-picker-item" data-value="PM">PM</div>`;
        hourCol.innerHTML = hours;
        minCol.innerHTML = minutes;
        ampmCol.innerHTML = ampm;

        const now = new Date();
        let currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentAmPm = currentHour >= 12 ? 'PM' : 'AM';
        currentHour = currentHour % 12 || 12;

        hourCol.querySelector(`[data-value="${currentHour}"]`)?.classList.add('selected');
        minCol.querySelector(`[data-value="${currentMinute}"]`)?.classList.add('selected');
        ampmCol.querySelector(`[data-value="${currentAmPm}"]`)?.classList.add('selected');
        
        setTimeout(() => {
            hourCol.querySelector('.selected')?.scrollIntoView({ block: 'center' });
            minCol.querySelector('.selected')?.scrollIntoView({ block: 'center' });
        }, 0);
        this.updateTimeDisplay();
    },

    updateTimeDisplay: function() {
        const hour = document.querySelector('#hour-column .selected')?.dataset.value || '01';
        const minute = document.querySelector('#minute-column .selected')?.dataset.value || '00';
        const ampm = document.querySelector('#ampm-column .selected')?.dataset.value || 'AM';
        document.getElementById('time-display').textContent = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${ampm}`;
        
        let hour24 = parseInt(hour, 10);
        if (ampm === 'PM' && hour24 < 12) hour24 += 12;
        if (ampm === 'AM' && hour24 === 12) hour24 = 0;
        document.getElementById('alarm-time-value').value = `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    },

    handleAlarmFormSubmit: async function(e) {
        e.preventDefault();
        const form = e.target;
        const saveBtn = document.getElementById('save-alarm-btn');
        const originalBtnText = saveBtn.textContent;
        const date = document.querySelector('duet-date-picker').value;
        const time = form.querySelector('#alarm-time-value').value;
        if (!date || !time) { alert(this.getText('alarm_form_error_datetime')); return; }
        const alarmTime = new Date(`${date}T${time}`).getTime();
        if (alarmTime <= Date.now()) { alert(this.getText('alarm_form_error_future')); return; }
        
        const alarm = {
            time: alarmTime,
            label: form.querySelector('#alarm-label').value,
            soundId: form.querySelector('#alarm-sound').value,
            isRepeating: form.querySelector('#alarm-repeat').checked
        };
        
        const id = await this.db.alarms.add(alarm);
        this.alarmWorker.postMessage({ type: 'SET_ALARM', alarm: { ...alarm, id } });
        form.reset();
        document.querySelector('duet-date-picker').value = '';
        document.getElementById('time-display').textContent = '--:-- --';
        this.closeTimePicker();
        this.renderAlarmList();
        
        saveBtn.innerHTML = `<i class="fas fa-check"></i> ${this.getText('alarm_form_saved')}`;
        setTimeout(() => { saveBtn.textContent = originalBtnText; }, 2000);
        this.swiper.slideTo(1, 300);
    },

    handleContactFormSubmit: function(e) {
        e.preventDefault();
        alert(this.getText('contact_title'));
        e.target.reset();
    },

    createStars: function() {
        if (document.querySelector('.star')) return;
        const bg = document.getElementById('dynamic-bg');
        let stars = '';
        for (let i = 0; i < 150; i++) {
            const size = Math.random() * 2 + 1;
            const top = Math.random() * 100;
            const left = Math.random() * 100;
            const delay = Math.random() * 3;
            stars += `<div class="star" style="width:${size}px; height:${size}px; top:${top}%; left:${left}%; animation-delay:${delay}s; animation-duration:${Math.random() * 2 + 2}s;"></div>`;
        }
        bg.insertAdjacentHTML('beforeend', stars);
    },

    createShootingStar: function() {
        const star = document.createElement('div');
        star.className = 'shooting-star';
        star.style.top = (Math.random() * window.innerHeight) + 'px';
        star.style.left = (Math.random() * window.innerWidth) + 'px';
        document.getElementById('dynamic-bg').appendChild(star);
        setTimeout(() => star.remove(), 2000);
    },

    createCloudElements: function() {
        if (document.querySelector('.cloud')) return;
        const bg = document.getElementById('dynamic-bg');
        let clouds = '';
        for (let i = 0; i < 5; i++) {
            const scale = Math.random() * 0.6 + 0.8;
            const top = Math.random() * 30 + 5;
            const duration = Math.random() * 50 + 80;
            const delay = Math.random() * -80;
            clouds += `<div class="cloud" style="top:${top}%; transform: scale(${scale}); animation-duration:${duration}s; animation-delay:${delay}s; width: 100px; height: 30px;"></div>`;
        }
        bg.insertAdjacentHTML('beforeend', clouds);
    },

    removeCloudElements: function() {
        document.querySelectorAll('.cloud').forEach(c => c.remove());
    },

    updateMoonPhase: function() {
        const now = new Date();
        let year = now.getFullYear();
        let month = now.getMonth() + 1;
        const day = now.getDate();
        let c, e, jd;
        if (month < 3) { year--; month += 12; }
        ++month;
        c = 365.25 * year;
        e = 30.6 * month;
        jd = c + e + day - 694039.09;
        jd /= 29.5305882;
        jd -= parseInt(jd);
        const phase = Math.round(jd * 8) % 8;
        let transform = '';
        if (phase === 0) transform = 'translateX(0%)';      // New Moon
        else if (phase === 1) transform = 'translateX(-75%)'; // Waxing Crescent
        else if (phase === 2) transform = 'translateX(-50%)'; // First Quarter
        else if (phase === 3) transform = 'translateX(-25%)'; // Waxing Gibbous
        else if (phase === 4) transform = 'translateX(-100%)';// Full Moon
        else if (phase === 5) transform = 'translateX(25%)';  // Waning Gibbous
        else if (phase === 6) transform = 'translateX(50%)';  // Last Quarter
        else if (phase === 7) transform = 'translateX(75%)';  // Waning Crescent
        document.querySelector('.moon-phase-overlay').style.transform = transform;
    },

    updatePomodoroDisplay: function() {
        const minutes = String(Math.floor(this.pomodoroRemainingTime / 60)).padStart(2, '0');
        const seconds = String(this.pomodoroRemainingTime % 60).padStart(2, '0');
        document.getElementById('pomodoro-timer').textContent = `${minutes}:${seconds}`;
        const controlBtnText = this.pomodoroInterval ? this.getText('pomodoro_pause_btn') : this.getText('pomodoro_start_btn');
        document.getElementById('pomodoro-control-btn').textContent = controlBtnText;
    },

    switchPomodoroMode: function(mode) {
        this.pomodoroMode = mode;
        this.pomodoroRemainingTime = this.pomodoro[mode] * 60;
        document.querySelectorAll('.pomodoro-mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
        this.updatePomodoroDisplay();
        this.pausePomodoro();
    },

    startPomodoro: function() {
        this.updatePomodoroDisplay();
        this.pomodoroInterval = setInterval(() => {
            this.pomodoroRemainingTime--;
            this.updatePomodoroDisplay();
            if (this.pomodoroRemainingTime <= 0) {
                clearInterval(this.pomodoroInterval);
                document.getElementById('pomodoro-complete-sound').play().catch(console.error);
                if (this.pomodoroMode === 'pomodoro') {
                    this.pomodoro.sessions++;
                    this.switchPomodoroMode(this.pomodoro.sessions % 4 === 0 ? 'longBreak' : 'shortBreak');
                } else {
                    this.switchPomodoroMode('pomodoro');
                }
            }
        }, 1000);
    },

    pausePomodoro: function() {
        clearInterval(this.pomodoroInterval);
        this.pomodoroInterval = null;
        this.updatePomodoroDisplay();
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
        const defaultSound = 'https://assets.mixkit.co/sfx/preview/mixkit-alarm-digital-bleep-991.mp3';
        
        if (alarm.soundId && alarm.soundId.startsWith('http')) {
            player.src = alarm.soundId;
        } else {
            try {
                const userSound = await this.db.userSounds.get(parseInt(alarm.soundId));
                player.src = userSound?.data instanceof Blob ? URL.createObjectURL(userSound.data) : defaultSound;
            } catch { player.src = defaultSound; }
        }
        player.play().catch(console.error);

        document.getElementById('fired-alarm-label').textContent = alarm.label || this.getText('alarm_fired_subtitle');
        
        const defaultTips = [ "Tạo một lịch trình ngủ đều đặn.", "Đảm bảo phòng ngủ tối, yên tĩnh và mát mẻ.", "Tránh thiết bị điện tử 30 phút trước khi ngủ.", "Tránh caffeine và rượu bia trước khi ngủ.", "Tập thể dục thường xuyên." ];
        const dbTips = await this.db.tips.toArray();
        let tipToShow = dbTips.length > 0 ? dbTips[Math.floor(Math.random() * dbTips.length)].content : this.getText('ai_welcome_message');
        const availableTips = defaultTips.filter(t => !dbTips.some(dt => dt.content === t));

        if(availableTips.length > 0) {
            tipToShow = availableTips[Math.floor(Math.random() * availableTips.length)];
            await this.db.tips.add({content: tipToShow});
            this.renderTipsList();
        }
        
        document.getElementById('tip-content').textContent = tipToShow;
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
        const locale = this.currentLanguage.startsWith('ja') ? 'ja-JP' : this.currentLanguage.startsWith('en') ? 'en-US' : 'vi-VN';
        listEl.innerHTML = alarms.map(alarm => {
            const date = new Date(alarm.time);
            const repeatIcon = alarm.isRepeating ? `<span class="ml-2" title="${this.getText('alarm_list_repeats')}"><i class="fas fa-sync-alt h-4 w-4 inline text-cyan-300"></i></span>` : '';
            const aiIcon = alarm.managedByAI ? `<span class="ml-2 text-purple-400 text-xs" title="${this.getText('alarm_list_ai_managed')}"><i class="fas fa-robot"></i></span>` : '';
            return `<div class="bg-gray-700/50 p-3 rounded-lg flex justify-between items-center">
                        <div class="flex-grow">
                            <div class="flex items-center">
                                <p class="font-bold truncate">${alarm.label || this.getText('alarm_list_default_label')}${repeatIcon}${aiIcon}</p>
                            </div>
                            <p class="text-sm text-gray-400">${date.toLocaleDateString(locale)} - ${date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}</p>
                        </div>
                        <button data-id="${alarm.id}" class="delete-alarm-btn text-red-400 hover:text-red-500 font-bold p-2 flex-shrink-0">${this.getText('alarm_list_delete')}</button>
                    </div>`;
        }).join('');
    },
    
    renderSoundList: async function() {
        const userSounds = await this.db.userSounds.toArray();
        const listEl = document.getElementById('sound-list');
        listEl.innerHTML = userSounds.length === 0 ? `<p class="text-gray-400 text-center">${this.getText('sound_list_empty')}</p>` :
            userSounds.map(s => `<div class="bg-gray-700/50 p-3 rounded-lg flex justify-between items-center">
                                    <p class="truncate w-48">${s.name}</p>
                                    <button data-id="${s.id}" class="delete-sound-btn text-red-400 hover:text-red-500 font-bold text-xs">${this.getText('alarm_list_delete')}</button>
                                 </div>`).join('');
        
        let options = '';
        const favorites = userSounds.filter(s => s.isFavorite);
        const nonFavorites = userSounds.filter(s => !s.isFavorite);

        if (favorites.length > 0) {
            options += `<optgroup label="⭐ ${this.getText('sound_option_favorite')}">`;
            options += favorites.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
            options += `</optgroup>`;
        }
        if (nonFavorites.length > 0) {
            options += `<optgroup label="${this.getText('sidebar_sounds_title')}">`;
            options += nonFavorites.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
            options += `</optgroup>`;
        }
        options += `<optgroup label="Default Sounds">`;
        for (const [key, sound] of Object.entries(this.ambientSoundFiles)) {
            options += `<option value="${sound.url}">${this.getText(sound.name_key)}</option>`;
        }
        options += `</optgroup>`;
        document.getElementById('alarm-sound').innerHTML = options;
    },

    renderTipsList: async function() {
        const tips = await this.db.tips.toArray();
        const listEl = document.getElementById('tips-list');
        listEl.innerHTML = tips.length === 0 ? `<p class="text-gray-400 text-center">${this.getText('tips_list_empty')}</p>` :
            tips.map(tip => `<div class="bg-gray-700/50 p-3 rounded-lg">${tip.content}</div>`).join('');
    },

    renderAmbientSoundGrid: async function() {
        const gridEl = document.getElementById('ambient-sounds-grid');
        const userSounds = await this.db.userSounds.toArray();
        const hiddenSettings = await this.db.settings.get("hiddenDefaultSounds") || { value: [] };
        const hiddenKeys = hiddenSettings.value;
        let html = '';

        for (const key in this.ambientSoundFiles) {
            if (hiddenKeys.includes(key)) continue;
            const sound = this.ambientSoundFiles[key];
            html += `<div class="sound-card" data-sound-key="default-${key}">
                        <div class="sound-card-icon"><i class="${sound.icon}"></i></div>
                        <h4 class="sound-card-name">${this.getText(sound.name_key)}</h4>
                        <button class="sound-options-btn"><i class="fas fa-ellipsis-v"></i></button>
                        <div class="sound-options-menu" data-key="${key}">
                            <button data-action="hide" class="text-gray-400"><i class="fas fa-eye-slash fa-fw mr-2"></i>${this.getText('sound_option_hide')}</button>
                        </div>
                    </div>`;
        }
        
        userSounds.forEach(sound => {
            const isFaIcon = sound.icon.startsWith("fa");
            const iconHtml = isFaIcon ? `<i class="${sound.icon}"></i>` : `<span>${sound.icon}</span>`;
            const favClass = sound.isFavorite ? "favorited" : "";
            html += `<div class="sound-card" data-sound-key="user-${sound.id}">
                        <div class="sound-card-icon">${iconHtml}</div>
                        <h4 class="sound-card-name">${sound.name}</h4>
                        <button class="sound-options-btn"><i class="fas fa-ellipsis-v"></i></button>
                        <div class="sound-options-menu" data-id="${sound.id}">
                            <button data-action="edit"><i class="fas fa-edit fa-fw mr-2"></i>${this.getText('sound_option_edit')}</button>
                            <button data-action="favorite"><i class="fas fa-star fa-fw mr-2 favorite-star ${favClass}"></i>${this.getText('sound_option_favorite')}</button>
                            <button data-action="delete" class="text-red-400"><i class="fas fa-trash fa-fw mr-2"></i>${this.getText('sound_option_delete')}</button>
                        </div>
                     </div>`;
        });

        html += `<div id="add-sound-card" class="sound-card">
                    <div class="sound-card-icon"><i class="fas fa-plus"></i></div>
                    <h4 class="sound-card-name">${this.getText('sound_card_add')}</h4>
                 </div>`;
        gridEl.innerHTML = html;
    },

    initStats: async function() {
        let stats = await this.db.settings.get('userStats');
        if (!stats) {
            stats = { key: 'userStats', value: { totalChillingTime: 0, sessions: 0, soundPlays: {} } };
            await this.db.settings.put(stats);
        }
        stats.value.sessions++;
        await this.db.settings.put(stats);
        this.renderPersonalStats();
        this.animateGlobalStats();
        this.startChillingTracker();
    },

    startChillingTracker: function() {
        if (this.chillingTimeTracker) clearInterval(this.chillingTimeTracker);
        this.chillingTimeTracker = setInterval(async () => {
            const player = document.getElementById('ambient-player');
            if (player && !player.paused) {
                let stats = await this.db.settings.get('userStats');
                stats.value.totalChillingTime++;
                await this.db.settings.put(stats);
                this.renderPersonalStats();
            }
        }, 1000);
    },

    updateSoundPlayCount: async function(soundKey) {
        let stats = await this.db.settings.get('userStats');
        stats.value.soundPlays[soundKey] = (stats.value.soundPlays[soundKey] || 0) + 1;
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
                favSound = key.startsWith('default-') ? this.getText(this.ambientSoundFiles[key.replace('default-', '')]?.name_key) : this.getText('stats_user_sound');
            }
        }
        document.getElementById('personal-favorite-sound').textContent = favSound;
    },

    animateGlobalStats: function() {
        let users = 1234 + Math.floor(Math.random() * 100);
        let hours = 5678 + Math.floor(Math.random() * 200);
        let visits = 9101 + Math.floor(Math.random() * 500);
        const usersEl = document.getElementById('global-users');
        const hoursEl = document.getElementById('global-hours');
        const visitsEl = document.getElementById('global-visits');
        const update = () => {
            users += Math.floor(Math.random() * 2);
            hours += Math.floor(Math.random() * 3);
            visits += Math.floor(Math.random() * 5);
            usersEl.textContent = users.toLocaleString(this.currentLanguage);
            hoursEl.textContent = hours.toLocaleString(this.currentLanguage);
            visitsEl.textContent = visits.toLocaleString(this.currentLanguage);
        };
        update();
        setInterval(update, 3000);
    },

    toggleSoundOptionsMenu: function(button) {
        const menu = button.nextElementSibling;
        document.querySelectorAll('.sound-options-menu').forEach(m => {
            if (m !== menu) m.style.display = 'none';
        });
        menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
    },

    handleSoundMenuAction: async function(target) {
        const action = target.dataset.action;
        const menu = target.closest('.sound-options-menu');
        const idOrKey = menu.dataset.id || menu.dataset.key;
        if (!action || !idOrKey) return;

        if (action === 'edit') {
            const sound = await this.db.userSounds.get(parseInt(idOrKey));
            if (sound) this.openEditSoundModal(sound);
        } else if (action === 'delete') {
            if (confirm(this.getText('confirm_delete_sound'))) {
                await this.deleteUserSound(parseInt(idOrKey));
            }
        } else if (action === 'favorite') {
            await this.toggleFavoriteStatus(parseInt(idOrKey), target.querySelector('.favorite-star'));
        } else if (action === 'hide') {
            await this.hideDefaultSound(idOrKey);
        }
        menu.style.display = 'none';
    },

    hideDefaultSound: async function(soundKey) {
        let settings = await this.db.settings.get('hiddenDefaultSounds') || { key: 'hiddenDefaultSounds', value: [] };
        if (!settings.value.includes(soundKey)) {
            settings.value.push(soundKey);
            await this.db.settings.put(settings);
            this.renderAmbientSoundGrid();
        }
    },

    unhideDefaultSound: async function(soundKey) {
        let settings = await this.db.settings.get('hiddenDefaultSounds');
        if (settings && settings.value) {
            settings.value = settings.value.filter(key => key !== soundKey);
            await this.db.settings.put(settings);
            this.renderAmbientSoundGrid();
            this.renderHiddenSoundsList();
        }
    },

    openRestoreSoundsModal: async function() {
        await this.renderHiddenSoundsList();
        document.getElementById('restore-sounds-modal').classList.remove('hidden');
    },

    renderHiddenSoundsList: async function() {
        const listEl = document.getElementById('hidden-sounds-list');
        const hidden = (await this.db.settings.get('hiddenDefaultSounds') || { value: [] }).value;
        if (hidden.length === 0) {
            listEl.innerHTML = `<p class="text-gray-400 text-center">${this.getText('restore_sound_empty')}</p>`;
            return;
        }
        listEl.innerHTML = hidden.map(key => {
            const sound = this.ambientSoundFiles[key];
            return sound ? `<div class="bg-gray-700/50 p-3 rounded-lg flex justify-between items-center">
                                <span class="flex items-center"><i class="${sound.icon} fa-fw mr-3"></i>${this.getText(sound.name_key)}</span>
                                <button data-sound-key="${key}" class="unhide-sound-btn text-cyan-400 hover:text-cyan-300 font-bold text-sm">${this.getText('restore_sound_unhide')}</button>
                            </div>` : '';
        }).join('');
    },

    openEditSoundModal: function(sound) {
        this.currentEditingSound = sound;
        document.getElementById('edit-sound-id').value = sound.id;
        document.getElementById('edit-sound-name').value = sound.name;
        document.getElementById('edit-sound-icon').value = sound.icon;
        document.getElementById('edit-sound-modal').classList.remove('hidden');
    },

    closeEditSoundModal: function() {
        document.getElementById('edit-sound-modal').classList.add('hidden');
        this.currentEditingSound = null;
    },

    saveEditedSound: async function(e) {
        e.preventDefault();
        const id = parseInt(document.getElementById('edit-sound-id').value);
        const name = document.getElementById('edit-sound-name').value;
        const icon = document.getElementById('edit-sound-icon').value;
        if (id && name) {
            await this.db.userSounds.update(id, { name, icon });
            this.closeEditSoundModal();
            this.renderAmbientSoundGrid();
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
        if (this.activeSoundKey === `user-${id}`) this.hideAudioPlayer();
        await this.db.userSounds.delete(id);
        this.renderAmbientSoundGrid();
        this.renderSoundList();
    },

    handleSoundUpload: function(event, isFromMainUploader = false) {
        const input = isFromMainUploader ? event.target : document.createElement('input');
        const processFile = (file) => {
            if (file) {
                const reader = new FileReader();
                reader.onload = async (e) => {
                    try {
                        const soundData = { name: file.name.replace(/\.[^/.]+$/, ""), icon: '🎵', isFavorite: false, data: new Blob([e.target.result], { type: file.type }) };
                        const id = await this.db.userSounds.add(soundData);
                        this.renderAmbientSoundGrid();
                        this.renderSoundList();
                        if (!isFromMainUploader) {
                            this.openEditSoundModal({ ...soundData, id });
                        }
                    } catch (err) { console.error("Error saving sound:", err); }
                };
                reader.readAsArrayBuffer(file);
            }
        };

        if (isFromMainUploader) {
            processFile(event.target.files[0]);
        } else {
            input.type = 'file';
            input.accept = 'audio/*';
            input.onchange = () => processFile(input.files[0]);
            input.click();
        }
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
        document.body.classList.add(themeName);
        this.removeCloudElements();
        if (themeName === 'theme-beach' || themeName === 'theme-dawn') this.createCloudElements();
        
        document.querySelectorAll('.theme-card').forEach(card => {
            const activeTheme = this.themeMode === 'auto' ? 'theme-auto' : this.lastManualTheme;
            card.classList.toggle('active', card.dataset.theme === activeTheme);
        });
        
        this.updateCelestialBodies();
        this.updateNightEffects();
    },

    updateCelestialBodies: function() {
        const sun = document.getElementById('sun');
        const moon = document.getElementById('moon');
        const hour = new Date().getHours() + new Date().getMinutes() / 60;

        if (this.themeMode === 'manual') {
            const currentTheme = this.lastManualTheme;
            sun.style.display = (currentTheme === 'theme-beach' || currentTheme === 'theme-dawn') ? 'block' : 'none';
            moon.style.display = (currentTheme === 'theme-sunset' || currentTheme === 'theme-default') ? 'block' : 'none';
            if (moon.style.display === 'block') this.updateMoonPhase();
            return;
        }

        const dayProgress = (hour - 4) / 16;
        if (dayProgress >= 0 && dayProgress <= 1) {
            sun.style.left = `calc(${dayProgress * 100}% - 50px)`;
            sun.style.top = `${50 - Math.sin(dayProgress * Math.PI) * 45}%`;
            sun.style.display = 'block';
        } else {
            sun.style.display = 'none';
        }
        
        let nightProgress = -1;
        if (hour >= 20) nightProgress = (hour - 20) / 8;
        else if (hour < 4) nightProgress = (hour + 24 - 20) / 8;
        
        if (nightProgress >= 0 && nightProgress <= 1) {
            moon.style.left = `calc(${nightProgress * 100}% - 50px)`;
            moon.style.top = `${50 - Math.sin(nightProgress * Math.PI) * 45}%`;
            moon.style.display = 'block';
            this.updateMoonPhase();
        } else {
            moon.style.display = 'none';
        }
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

    updateClock: function() {
        document.getElementById('clock').textContent = new Date().toLocaleTimeString(this.currentLanguage);
        this.applyThemeBasedOnMode();
    },

    saveSettings: async function() {
        await this.db.settings.put({ key: 'themeMode', value: this.themeMode });
        await this.db.settings.put({ key: 'lastManualTheme', value: this.lastManualTheme });
    },

    toggleAmbientSound: async function(soundKey) {
        const player = document.getElementById('ambient-player');
        if (this.activeSoundKey === soundKey && !player.paused) {
            return this.hideAudioPlayer();
        }
        if (player.src.startsWith('blob:')) URL.revokeObjectURL(player.src);

        let soundInfo = {};
        if (soundKey.startsWith('default-')) {
            soundInfo = this.ambientSoundFiles[soundKey.replace('default-', '')];
        } else {
            const userSound = await this.db.userSounds.get(parseInt(soundKey.replace('user-', '')));
            if(userSound) soundInfo = { name: userSound.name, url: URL.createObjectURL(userSound.data) };
        }
        
        if (soundInfo.url) {
            this.activeSoundKey = soundKey;
            player.src = soundInfo.url;
            player.play().catch(console.error);
            this.updatePlayerUI();
            this.updateSoundPlayCount(soundKey);
        }
    },

    hideAudioPlayer: function() {
        const player = document.getElementById('ambient-player');
        if (player.src.startsWith('blob:')) URL.revokeObjectURL(player.src);
        player.pause();
        player.src = '';
        this.activeSoundKey = null;
        this.updatePlayerUI();
    },

    toggleAmbientSoundPlayback: function() {
        const player = document.getElementById('ambient-player');
        if (player.src) {
            player.paused ? player.play() : player.pause();
        }
    },

    updatePlayerUI: async function() {
        const player = document.getElementById('ambient-player');
        const soundNameEl = document.getElementById('current-sound-name');
        const isPlaying = this.activeSoundKey !== null && !player.paused;

        document.getElementById('audio-player-container').classList.toggle('show', this.activeSoundKey !== null);
        document.getElementById('player-play-icon').classList.toggle('hidden', isPlaying);
        document.getElementById('player-pause-icon').classList.toggle('hidden', !isPlaying);
        document.querySelectorAll('.sound-card').forEach(card => card.classList.remove('playing'));

        if (this.activeSoundKey) {
            if(isPlaying) document.querySelector(`.sound-card[data-sound-key="${this.activeSoundKey}"]`)?.classList.add('playing');
            const key = this.activeSoundKey;
            if (key.startsWith('default-')) {
                soundNameEl.textContent = this.getText(this.ambientSoundFiles[key.replace('default-', '')]?.name_key) || '...';
            } else {
                const sound = await this.db.userSounds.get(parseInt(key.replace('user-', '')));
                soundNameEl.textContent = sound?.name || '...';
            }
        } else {
            soundNameEl.textContent = this.getText('player_default_name');
        }
    }
};

document.addEventListener('DOMContentLoaded', () => CozyWebApp.init());

