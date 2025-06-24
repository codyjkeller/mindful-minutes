import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as Tone from 'tone';

// --- Helper Components ---

const Icon = ({ path, className = "w-6 h-6" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
);

const Modal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 text-slate-800 dark:text-slate-200">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">{title}</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                        <Icon path="M6 18L18 6M6 6l12 12" />
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
};

const Calendar = ({ history }) => {
    const today = new Date();
    const month = today.getMonth();
    const year = today.getFullYear();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();

    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const blanks = Array.from({ length: firstDayOfMonth }, (_, i) => i);

    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
        <div className="p-4 bg-slate-100 dark:bg-slate-700/50 rounded-lg">
             <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-lg">{today.toLocaleString('default', { month: 'long' })} {year}</h3>
            </div>
            <div className="grid grid-cols-7 gap-2 text-center text-sm">
                {weekDays.map(day => <div key={day} className="font-semibold text-slate-500 dark:text-slate-400">{day}</div>)}
                {blanks.map(blank => <div key={`blank-${blank}`}></div>)}
                {days.map(day => {
                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const session = history[dateStr];
                    const isToday = day === today.getDate();
                    
                    return (
                        <div key={day} className={`
                            relative w-9 h-9 flex items-center justify-center rounded-full
                            ${session ? 'bg-teal-300 dark:bg-teal-600 text-white font-bold' : ''}
                            ${isToday && !session ? 'bg-slate-200 dark:bg-slate-600' : ''}
                        `}>
                            {day}
                            {session && (
                                <div className="absolute -bottom-2 text-xs text-slate-500 dark:text-slate-400">
                                    {Math.round(session / 60)}m
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};


// --- Main App Component ---

export default function App() {
    // --- State Management ---
    const [duration, setDuration] = useState(10 * 60); // 10 minutes in seconds
    const [timeLeft, setTimeLeft] = useState(duration);
    const [isActive, setIsActive] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(true);

    const [settings, setSettings] = useState({
        sound: 'rain',
        fadeInOut: true,
        intervalChime: 5, // minutes, 0 for off
    });
    const [history, setHistory] = useState({}); // e.g., {'2024-06-24': 600}

    // --- Modal States ---
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [isSoundSelectionOpen, setIsSoundSelectionOpen] = useState(false);

    // --- Audio Synthesis with Tone.js (useRef to keep instances stable) ---
    const audioRefs = useRef({});

    const initializeAudio = useCallback(() => {
        if (!audioRefs.current.isInitialized) {
             // Rain sound
            const rainNoise = new Tone.Noise("pink").start();
            const filter = new Tone.AutoFilter({
                frequency: '8n',
                baseFrequency: 400,
                octaves: 2
            }).toDestination().start();
            rainNoise.connect(filter);

            // Singing Bowl (Interval Chime & End)
            const bowl = new Tone.MetalSynth({
                frequency: 200,
                envelope: { attack: 0.001, decay: 1.4, release: 0.2 },
                harmonicity: 5.1,
                modulationIndex: 32,
                resonance: 4000,
                octaves: 1.5,
            }).toDestination();

            // Forest (Brown Noise + high-freq chirp)
            const brownNoise = new Tone.Noise("brown").start();
            const forestFilter = new Tone.AutoFilter({
                frequency: "4n",
                baseFrequency: 200,
                octaves: 1
            }).toDestination().start();
            brownNoise.connect(forestFilter);
            const chirp = new Tone.FMSynth({
                harmonicity: 1,
                modulationIndex: 10,
                envelope: { attack: 0.01, decay: 0.1 },
                modulationEnvelope: { attack: 0.01, decay: 0.2 }
            }).toDestination();
            
             // Binaural Beat
            const leftEar = new Tone.Oscillator(100, "sine").toDestination().setStereoPan(-1);
            const rightEar = new Tone.Oscillator(104, "sine").toDestination().setStereoPan(1);


            audioRefs.current = {
                isInitialized: true,
                rain: { noise: rainNoise, filter },
                bowl,
                forest: { noise: brownNoise, filter: forestFilter, chirp },
                binaural: { left: leftEar, right: rightEar },
                mainVolume: new Tone.Volume(-20).toDestination()
            };
            
            audioRefs.current.rain.noise.connect(audioRefs.current.mainVolume);
            audioRefs.current.forest.noise.connect(audioRefs.current.mainVolume);
            audioRefs.current.binaural.left.connect(audioRefs.current.mainVolume);
            audioRefs.current.binaural.right.connect(audioRefs.current.mainVolume);

            // Set initial volume
            audioRefs.current.mainVolume.volume.value = -Infinity; // Muted by default
        }
    }, []);
    
    // --- Audio Controls ---
    const playSound = useCallback(() => {
        const { sound, fadeInOut } = settings;
        const { mainVolume, rain, forest, binaural } = audioRefs.current;
        
        if (!audioRefs.current.isInitialized) return;

        // Stop all sounds first
        rain.noise.volume.value = -Infinity;
        forest.noise.volume.value = -Infinity;
        binaural.left.stop();
        binaural.right.stop();

        // Select and play the correct sound
        if (sound === 'rain') {
            rain.noise.volume.value = 0; // Unmute rain part
        } else if (sound === 'forest') {
            forest.noise.volume.value = 0; // Unmute forest part
        } else if (sound === 'binaural') {
            binaural.left.start();
            binaural.right.start();
        }

        if (sound !== 'none') {
            const targetVolume = -20;
            if (fadeInOut) {
                mainVolume.volume.rampTo(targetVolume, 2.0);
            } else {
                mainVolume.volume.value = targetVolume;
            }
        }
    }, [settings]);

    const stopSound = useCallback(() => {
        if (!audioRefs.current.isInitialized) return;
        const { mainVolume, rain, forest, binaural } = audioRefs.current;

        const { fadeInOut } = settings;
        if (fadeInOut) {
            mainVolume.volume.rampTo(-Infinity, 2.0);
        } else {
            mainVolume.volume.value = -Infinity;
        }
        
        setTimeout(() => {
             if (!isActive) { // Extra check to ensure timer hasn't restarted
                rain.noise.volume.value = -Infinity;
                forest.noise.volume.value = -Infinity;
                binaural.left.stop();
                binaural.right.stop();
            }
        }, 2100);

    }, [settings, isActive]);
    
    const playChime = useCallback(() => {
         if (!audioRefs.current.isInitialized) return;
        audioRefs.current.bowl.triggerAttackRelease("C4", "2n");
    }, []);
    
    // --- Timer Logic ---
    useEffect(() => {
        let timer;
        if (isActive && timeLeft > 0) {
            timer = setInterval(() => {
                setTimeLeft(prev => prev - 1);
                // Interval Chime Logic
                const { intervalChime } = settings;
                if (intervalChime > 0 && (duration - timeLeft + 1) % (intervalChime * 60) === 0 && (timeLeft-1) > 0) {
                     playChime();
                }
            }, 1000);
        } else if (timeLeft === 0 && isActive) {
            setIsActive(false);
            stopSound();
            playChime();
            // Record history
            const todayStr = new Date().toISOString().split('T')[0];
            setHistory(prev => ({
                ...prev,
                [todayStr]: (prev[todayStr] || 0) + duration
            }));
            // Reset for next session
            setTimeout(() => setTimeLeft(duration), 1200);
        }
        return () => clearInterval(timer);
    }, [isActive, timeLeft, duration, settings, stopSound, playChime]);

    // --- Handlers ---
    const handleStartPause = async () => {
        // Initialize and resume audio context on user gesture
        if (Tone.context.state !== 'running') {
            await Tone.start();
        }
        initializeAudio();

        if (isActive) {
            setIsActive(false);
            stopSound();
        } else {
            setIsActive(true);
            playSound();
        }
    };

    const handleReset = () => {
        setIsActive(false);
        setTimeLeft(duration);
        stopSound();
    };

    const handleDurationChange = (newDurationInSeconds) => {
        if (!isActive) {
            setDuration(newDurationInSeconds);
            setTimeLeft(newDurationInSeconds);
        }
    };
    
    const handleSettingChange = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    const handleSoundSelect = (sound) => {
        handleSettingChange('sound', sound);
        setIsSoundSelectionOpen(false);
        // If timer is active, switch sound immediately
        if (isActive) {
            playSound();
        }
    }
    
    // --- UI Calculations ---
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

    const progress = ((duration - timeLeft) / duration) * 100;

    // --- UI Data ---
    const soundOptions = [
        { id: 'none', name: 'Silent Meditation', icon: 'M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z' },
        { id: 'rain', name: 'Gentle Rain', icon: 'M10.5 21a8.952 8.952 0 005.27-1.634.75.75 0 01.32-1.428l-2.09-1.206a.75.75 0 01-.32-1.428 6.45 6.45 0 01-4.43-4.43.75.75 0 011.428-.32l1.206 2.09a.75.75 0 011.428.32 8.952 8.952 0 001.634-5.27c0-4.968-4.032-9-9-9s-9 4.032-9 9 4.032 9 9 9z' },
        { id: 'forest', name: 'Forest Ambience', icon: 'M18.38 4.62a1.5 1.5 0 00-2.12 0l-7.12 7.13a1.5 1.5 0 000 2.12l7.12 7.12a1.5 1.5 0 002.12-2.12L13.36 12l5.02-5.02a1.5 1.5 0 000-2.36z' },
        { id: 'binaural', name: 'Binaural Beat (Focus)', icon: 'M9 9l10.5-3m0 6.553v3.776a3.75 3.75 0 01-3.75 3.75h-4.5a3.75 3.75 0 01-3.75-3.75V10.5a3.75 3.75 0 013.75-3.75h4.5a3.75 3.75 0 013.75 3.75z' },
    ];
    const currentSound = soundOptions.find(s => s.id === settings.sound);

    const durationOptions = [
        { label: '30s', value: 30 }, { label: '1m', value: 60 }, { label: '2m', value: 120 },
        { label: '5m', value: 300 }, { label: '10m', value: 600 }, { label: '15m', value: 900 },
        { label: '20m', value: 1200 }, { label: '30m', value: 1800 }, { label: '45m', value: 2700 },
        { label: '60m', value: 3600 },
    ];
    
    const firstRowOptions = durationOptions.slice(0, 5);
    const secondRowOptions = durationOptions.slice(5, 10);


    return (
        <div className={isDarkMode ? 'dark' : ''}>
            <div className="bg-slate-100 dark:bg-slate-900 min-h-screen text-slate-800 dark:text-slate-200 transition-colors duration-500 font-sans">
                <div className="container mx-auto px-4 py-8 max-w-lg flex flex-col h-screen">
                    {/* --- Header --- */}
                    <header className="flex justify-between items-center mb-8">
                        <h1 className="text-xl font-bold tracking-wider text-slate-500 dark:text-slate-400">MINDFUL MINUTES</h1>
                        <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                            <Icon path={isDarkMode ? "M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.95-4.243l-1.59-1.59M3 12h2.25m.386-6.364l1.59 1.591" : "M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"} />
                        </button>
                    </header>

                    {/* --- Timer Display --- */}
                    <main className="flex-grow flex items-center justify-center">
                        <div className="relative w-72 h-72 md:w-80 md:h-80 flex items-center justify-center">
                            <svg className="absolute w-full h-full" viewBox="0 0 100 100">
                                <circle className="text-slate-200 dark:text-slate-700" stroke="currentColor" cx="50" cy="50" r="45" strokeWidth="4" fill="transparent" />
                                <circle
                                    className="text-teal-400 dark:text-teal-500"
                                    stroke="currentColor" cx="50" cy="50" r="45" strokeWidth="4" fill="transparent"
                                    strokeDasharray="282.6"
                                    strokeDashoffset={282.6 - (progress / 100) * 282.6}
                                    strokeLinecap="round"
                                    transform="rotate(-90 50 50)"
                                    style={{ transition: 'stroke-dashoffset 1s linear' }}
                                />
                            </svg>
                            <div className="relative z-10 flex flex-col items-center">
                                <span className="text-6xl md:text-7xl font-thin tracking-widest">{formatTime(timeLeft)}</span>
                                <span className="text-slate-500 dark:text-slate-400 text-lg">{formatTime(duration)}</span>
                            </div>
                        </div>
                    </main>
                    
                     {/* --- Duration Selector --- */}
                    <div className="flex flex-col items-center gap-2 mb-6">
                        <div className="flex justify-center items-center gap-2">
                            {firstRowOptions.map(opt => (
                                 <button key={opt.value} onClick={() => handleDurationChange(opt.value)} className={`px-4 py-2 rounded-full transition-colors text-sm font-medium ${duration === opt.value ? 'bg-teal-400 dark:bg-teal-600 text-white' : 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600'}`}>
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                         <div className="flex justify-center items-center gap-2">
                            {secondRowOptions.map(opt => (
                                 <button key={opt.value} onClick={() => handleDurationChange(opt.value)} className={`px-4 py-2 rounded-full transition-colors text-sm font-medium ${duration === opt.value ? 'bg-teal-400 dark:bg-teal-600 text-white' : 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600'}`}>
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* --- Controls --- */}
                    <footer className="flex flex-col items-center gap-6">
                        <button onClick={handleStartPause} className="bg-teal-500 hover:bg-teal-600 dark:bg-teal-600 dark:hover:bg-teal-700 text-white rounded-full p-6 shadow-lg transition-transform transform active:scale-95">
                            <Icon path={isActive ? "M15.75 5.25v13.5m-6-13.5v13.5" : "M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z"} className="w-10 h-10" />
                        </button>
                        <div className="w-full flex justify-around items-center">
                             <button onClick={() => setIsHistoryOpen(true)} className="flex flex-col items-center gap-1 text-slate-500 dark:text-slate-400 hover:text-teal-500 dark:hover:text-teal-400 transition-colors">
                                <Icon path="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0h18" />
                                <span className="text-xs font-medium">History</span>
                            </button>
                             <button onClick={() => setIsSoundSelectionOpen(true)} className="flex flex-col items-center gap-1 text-slate-500 dark:text-slate-400 hover:text-teal-500 dark:hover:text-teal-400 transition-colors">
                                <Icon path={currentSound.icon} />
                                <span className="text-xs font-medium">{currentSound.name}</span>
                            </button>
                             <button onClick={() => setIsSettingsOpen(true)} className="flex flex-col items-center gap-1 text-slate-500 dark:text-slate-400 hover:text-teal-500 dark:hover:text-teal-400 transition-colors">
                                <Icon path="M9.594 3.94c.09-.542.56-1.008 1.11-1.226a11.96 11.96 0 013.59 0c.55.218 1.02.684 1.11 1.226.094.557.062 1.182-.095 1.767l-1.028 3.083a2.25 2.25 0 01-2.122 1.583h-1.396a2.25 2.25 0 01-2.122-1.583L9.69 5.707a1.125 1.125 0 01-.095-1.767zM12 18c-3.314 0-6-2.686-6-6s2.686-6 6-6 6 2.686 6 6-2.686 6-6 6z" />
                                <span className="text-xs font-medium">Settings</span>
                            </button>
                        </div>
                    </footer>
                </div>

                {/* --- Modals --- */}
                <Modal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} title="Settings">
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <label htmlFor="fadeInOut" className="font-medium">Gentle fade-in & fade-out</label>
                            <button onClick={() => handleSettingChange('fadeInOut', !settings.fadeInOut)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.fadeInOut ? 'bg-teal-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.fadeInOut ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>
                        <div>
                           <label htmlFor="intervalChime" className="block font-medium mb-2">Interval Chime</label>
                            <div className="flex justify-between items-center gap-2">
                                {[0, 1, 5, 10, 15].map(min => (
                                    <button key={`chime-${min}`} onClick={() => handleSettingChange('intervalChime', min)} className={`flex-1 py-2 rounded-lg transition-colors text-sm font-medium ${settings.intervalChime === min ? 'bg-teal-400 dark:bg-teal-600 text-white' : 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600'}`}>
                                        {min === 0 ? 'Off' : `${min}m`}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </Modal>
                
                <Modal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} title="Session History">
                    <Calendar history={history} />
                </Modal>

                <Modal isOpen={isSoundSelectionOpen} onClose={() => setIsSoundSelectionOpen(false)} title="Select Ambient Sound">
                    <div className="space-y-3">
                        {soundOptions.map(sound => (
                             <button key={sound.id} onClick={() => handleSoundSelect(sound.id)} className={`w-full flex items-center gap-4 p-4 rounded-lg text-left transition-colors ${settings.sound === sound.id ? 'bg-teal-100 dark:bg-teal-800/50 ring-2 ring-teal-500' : 'hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                                <Icon path={sound.icon} className="w-8 h-8 text-teal-500" />
                                <div>
                                    <h3 className="font-bold">{sound.name}</h3>
                                </div>
                            </button>
                        ))}
                    </div>
                </Modal>

            </div>
        </div>
    );
}

