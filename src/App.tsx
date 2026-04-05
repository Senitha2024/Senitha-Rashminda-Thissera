/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Brush, 
  Eraser, 
  Trash2, 
  Undo, 
  Save, 
  Sparkles, 
  Palette, 
  Pen, 
  Wind, 
  CloudRain, 
  Circle, 
  Square, 
  Triangle, 
  Star, 
  Search, 
  MessageCircle, 
  Brain, 
  Lightbulb, 
  BookOpen, 
  Upload, 
  Globe, 
  Download,
  Key, 
  Wifi, 
  WifiOff, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Users,
  Feather,
  Droplets,
  Cloud,
  Wand2,
  Image as ImageIcon,
  MousePointer2,
  Smile,
  Heart,
  Star as StarIcon,
  Cat,
  Dog,
  Home,
  TreePine,
  Sun,
  Flower2,
  Rocket,
  Fish,
  Bug,
  PawPrint,
  Car
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import { cn } from './lib/utils';

// Firebase imports
import { auth, db, googleProvider } from './firebase';
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  serverTimestamp,
  getDocFromServer,
  orderBy,
  limit
} from 'firebase/firestore';

// --- Types ---
declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

type Tool = 'brush' | 'pen' | 'spray' | 'rainbow' | 'glow' | 'eraser' | 'fill' | 'shapes' | 'stamp' | 'charcoal' | 'watercolor';
type Shape = 'rect' | 'circle' | 'triangle' | 'star' | 'heart' | 'cloud';
type Tab = 'draw' | 'chat' | 'learn' | 'tips' | 'tutorial' | 'upload' | 'community' | 'video' | 'ai-gen' | 'photo-edit';
type AppMode = 'kids' | 'advanced';
type Lang = 'en' | 'si' | 'ta' | 'hi' | 'fr' | 'es';

interface DrawingProgram {
  (x: number, y: number, s: number): Promise<void>;
}

interface CommunityDrawing {
  id: string;
  userId: string;
  userName: string;
  name: string;
  imageData?: string;
  code?: string;
  likesCount: number;
  createdAt: any;
  hasLiked?: boolean;
}

interface Comment {
  id: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  text: string;
  createdAt: any;
}

// --- Constants ---
const COLORS = [
  '#FF4136', '#FF851B', '#FFDC00', '#2ECC40', '#00BFFF', '#7B68EE', '#FF69B4',
  '#FF6347', '#00CED1', '#8B4513', '#FFFFFF', '#111111', '#A8D8A8', '#FFB6C1',
  '#87CEEB', '#DDA0DD', '#F0E68C', '#98FB98', '#FFA07A', '#B0C4DE'
];

const STAMPS = ['⭐', '🌸', '❤️', '🦋', '🌟', '🐱', '🐶', '🌈', '🍕', '🎉', '🦄', '🌻', '🎈', '🍦', '🌙', '🔥', '💎', '🐸', '🎵', '🏆'];

const DRAWABLES = [
  { label: '🐱 Cat', key: 'cat', icon: Cat },
  { label: '🐶 Dog', key: 'dog', icon: Dog },
  { label: '🏡 House', key: 'house', icon: Home },
  { label: '🌳 Tree', key: 'tree', icon: TreePine },
  { label: '🌈 Rainbow', key: 'rainbow', icon: CloudRain },
  { label: '☀️ Sun', key: 'sun', icon: Sun },
  { label: '🌸 Flower', key: 'flower', icon: Flower2 },
  { label: '🚀 Rocket', key: 'rocket', icon: Rocket },
  { label: '🐟 Fish', key: 'fish', icon: Fish },
  { label: '🦋 Butterfly', key: 'butterfly', icon: Bug },
  { label: '⭐ Star', key: 'star', icon: StarIcon },
  { label: '🦕 Dino', key: 'dinosaur', icon: PawPrint },
  { label: '🚗 Car', key: 'car', icon: Car }
];

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const MESSAGES = {
  en: {
    drawing: (w: string) => `🎨 Watch me draw a ${w} for you! ✨`,
    done: (w: string) => `🎉 Ta-da! I drew a ${w}! Now add your own details!`,
    noIdea: `🤔 I don't know that yet! Use 🧠 Learn tab to teach me! Or try: cat, dog, house, tree, rainbow, sun, flower, rocket, fish, butterfly, star, dinosaur!`,
    tip: `🖌️ Try the GLOW ✨ brush to add magic!`,
    typing: `✏️ AI is drawing... watch the canvas!`,
    welcome: `👋 Hi! I can DRAW for you! Type "draw a cat" or click the green buttons!`,
    learned: (n: string) => `🌟 I just learned to draw a ${n}! Click its button!`,
    uploadTitle: '🖼️ Drop an image here or click to upload!',
    uploadSub: 'PNG, JPG, GIF supported • Up to 5 images',
    tutTitle: '📚 Drawing Tutorials',
  },
  si: {
    drawing: (w: string) => `🎨 බලන්න, මම ${w} ඇදිනවා! ✨`,
    done: (w: string) => `🎉 මම ${w} ඇදලා ඉවරයි!`,
    noIdea: `🤔 ඒ ඇදීමට දන්නේ නැහැ! 🧠 Learn tab එකෙන් ඉගැන්වෙන්න!`,
    tip: `🖌️ GLOW ✨ tool සහ ස්ටෑම්ප් සමඟ සරසන්න!`,
    typing: `✏️ AI ඇදිනවා... canvas බලන්න!`,
    welcome: `👋 හෙලෝ! මම canvas එකේ ඇදිය හැකියි! "draw a cat" ටයිප් කරන්න!`,
    learned: (n: string) => `🌟 ${n} ඇදීම ඉගෙනගත්තා!`,
    uploadTitle: '🖼️ රූපය මෙහි ඇදගෙන හෝ ක්ලික් කරන්න!',
    uploadSub: 'PNG, JPG, GIF ආකෘති සහය',
    tutTitle: '📚 ඇදීමේ නිබන්ධ',
  },
  ta: {
    drawing: (w: string) => `🎨 பாருங்கள், நான் ${w} வரைகிறேன்! ✨`,
    done: (w: string) => `🎉 பாருங்கள்! ${w} வரைந்தாயிற்று!`,
    noIdea: `🤔 அதை வரைய தெரியவில்லை! 🧠 Learn tab பயன்படுத்துங்கள்!`,
    tip: `🖌️ GLOW ✨ தூரிகை மாயத்தை சேர்க்கும்!`,
    typing: `✏️ AI வரைகிறது... கேன்வாஸை பாருங்கள்!`,
    welcome: `👋 வணக்கம்! நான் வரைவேன்! "draw a cat" என்று தட்டச்சு செய்யுங்கள்!`,
    learned: (n: string) => `🌟 ${n} வரைய கற்றேன்!`,
    uploadTitle: '🖼️ படத்தை இங்கே இழுக்கவும் அல்லது கிளிக் செய்யவும்!',
    uploadSub: 'PNG, JPG, GIF ஆதரிக்கப்படுகிறது',
    tutTitle: '📚 வரைதல் பயிற்சிகள்',
  },
  hi: {
    drawing: (w: string) => `🎨 देखो, मैं ${w} बना रहा हूँ! ✨`,
    done: (w: string) => `🎉 वाह! ${w} बन गया! अब अपना जादू दिखाओ!`,
    noIdea: `🤔 मुझे वो नहीं आता! 🧠 Learn tab में सिखाओ!`,
    tip: `🖌️ GLOW ✨ ब्रश से जादू जोड़ो!`,
    typing: `✏️ AI बना रहा है... canvas देखो!`,
    welcome: `👋 नमस्ते! मैं बना सकता हूँ! "draw a cat" टाइप करो!`,
    learned: (n: string) => `🌟 मैंने ${n} बनाना सीख लिया!`,
    uploadTitle: '🖼️ तस्वीर यहाँ डालो या क्लिक करो!',
    uploadSub: 'PNG, JPG, GIF समर्थित',
    tutTitle: '📚 ड्राइंग ट्यूटोरियल',
  },
  fr: {
    drawing: (w: string) => `🎨 Regardez, je dessine un ${w} ! ✨`,
    done: (w: string) => `🎉 Voilà ! J'ai dessiné un ${w} !`,
    noIdea: `🤔 Je ne sais pas encore ! Utilise l'onglet 🧠 Apprendre !`,
    tip: `🖌️ Essaie le pinceau GLOW ✨ pour de la magie !`,
    typing: `✏️ L'IA dessine... regarde le canevas !`,
    welcome: `👋 Bonjour ! Je peux dessiner ! Tape "draw a cat" ou clique !`,
    learned: (n: string) => `🌟 J'ai appris à dessiner un ${n} !`,
    uploadTitle: '🖼️ Glisse une image ici ou clique !',
    uploadSub: 'PNG, JPG, GIF supportés',
    tutTitle: '📚 Tutoriels de Dessin',
  },
  es: {
    drawing: (w: string) => `🎨 ¡Mira, voy a dibujar un ${w}! ✨`,
    done: (w: string) => `🎉 ¡Listo! ¡Dibujé un ${w}!`,
    noIdea: `🤔 ¡Aún no sé! Usa la pestaña 🧠 Aprender para enseñarme.`,
    tip: `🖌️ ¡Prueba el pincel GLOW ✨ para agregar magia!`,
    typing: `✏️ La IA está dibujando... ¡mira el lienzo!`,
    welcome: `👋 ¡Hola! ¡Puedo dibujar! Escribe "draw a cat" o haz clic.`,
    learned: (n: string) => `🌟 ¡Aprendí a dibujar un ${n}!`,
    uploadTitle: '🖼️ ¡Arrastra una imagen aquí o haz clic!',
    uploadSub: 'PNG, JPG, GIF admitidos',
    tutTitle: '📚 Tutoriales de Dibujo',
  }
};

const SOUNDS = {
  click: 'https://www.soundjay.com/buttons/button-16.mp3',
  draw: 'https://www.soundjay.com/misc/scribble-01.mp3',
  magic: 'https://www.soundjay.com/magic/magic-chime-01.mp3',
  whoosh: 'https://www.soundjay.com/misc/sounds/wind-chime-1.mp3',
  success: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3',
  erase: 'https://www.soundjay.com/misc/sounds/eraser-1.mp3'
};

export default function App() {
  const [loading, setLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTool, setCurrentTool] = useState<Tool>('brush');
  const [currentColor, setCurrentColor] = useState(COLORS[0]);
  const [brushSize, setBrushSize] = useState(14);
  const [opacity, setOpacity] = useState(1);
  const [appMode, setAppMode] = useState<AppMode>('kids');
  const [activeStamp, setActiveStamp] = useState('⭐');
  const [currentShape, setCurrentShape] = useState<Shape>('rect');
  const [activeTab, setActiveTab] = useState<Tab>('draw');
  const [lang, setLang] = useState<Lang>('en');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [smoothBrush, setSmoothBrush] = useState(true);
  const [apiKey, setApiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [aiDrawing, setAiDrawing] = useState(false);
  const [aiStatus, setAiStatus] = useState('');
  const [aiBubble, setAiBubble] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'model', text: string }[]>([]);
  const [learnedNames, setLearnedNames] = useState<string[]>([]);
  const [learnedDrawings, setLearnedDrawings] = useState<Record<string, DrawingProgram>>({});
  const [communityItems, setCommunityItems] = useState<CommunityDrawing[]>([]);
  const [selectedDrawing, setSelectedDrawing] = useState<CommunityDrawing | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLiking, setIsLiking] = useState<Record<string, boolean>>({});
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [drawCount, setDrawCount] = useState(0);

  // Photo Editing State
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [grayscale, setGrayscale] = useState(0);
  const [sepia, setSepia] = useState(0);
  const [invert, setInvert] = useState(0);
  const [blur, setBlur] = useState(0);
  const [hueRotate, setHueRotate] = useState(0);
  const [saturate, setSaturate] = useState(100);

  // Firebase & Advanced AI State
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isVideoGenerating, setIsVideoGenerating] = useState(false);
  const [videoProgress, setVideoProgress] = useState('');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });
  }, []);

  const installApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const playSound = useCallback((key: keyof typeof SOUNDS) => {
    if (isMuted) return;
    const audio = new Audio(SOUNDS[key]);
    audio.volume = 0.4;
    audio.play().catch(() => {}); // Ignore autoplay blocks
  }, [isMuted]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const rainbowHueRef = useRef(0);
  const snapCanvasRef = useRef<ImageData | null>(null);
  const shapeStartRef = useRef<{ x: number, y: number } | null>(null);
  const lastMidPointRef = useRef<{ x: number, y: number } | null>(null);
  const pointsRef = useRef<{ x: number, y: number }[]>([]);

  // Load learned drawings from Firestore
  useEffect(() => {
    if (!user) return;
    
    const q = query(collection(db, 'learned_items'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newLearnedNames: string[] = [];
      const newLearnedDrawings: Record<string, any> = {};
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        const code = data.code;
        const name = data.name;
        
        try {
          const drawFn = new Function('aiLine', 'aiCircle', 'aiEllipse', 'aiCurve', 'aiFill', 'W', 'H', 'sleep',
            `return async function(x, y, s) {
              try {
                ${code}
              } catch(e) { console.error("AI Drawing Error:", e); }
            }`
          )(aiLine, aiCircle, aiEllipse, aiCurve, aiFill, () => canvasRef.current!.width, () => canvasRef.current!.height, (ms: number) => new Promise(r => setTimeout(r, ms)));
          
          newLearnedDrawings[name] = drawFn;
          newLearnedNames.push(name);
        } catch (e) {
          console.error("Failed to load learned drawing:", name, e);
        }
      });
      
      setLearnedDrawings(prev => ({ ...prev, ...newLearnedDrawings }));
      setLearnedNames(prev => [...new Set([...prev, ...newLearnedNames])]);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'learned_items');
    });
    
    return () => unsubscribe();
  }, [user]);

  // Load community drawings
  useEffect(() => {
    const q = query(collection(db, 'community_drawings'), orderBy('createdAt', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: CommunityDrawing[] = [];
      snapshot.forEach(doc => {
        items.push({ id: doc.id, ...doc.data() } as CommunityDrawing);
      });
      setCommunityItems(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'community_drawings');
    });
    return () => unsubscribe();
  }, []);

  // --- Initialization ---
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 2000);
    window.addEventListener('online', () => setIsOnline(true));
    window.addEventListener('offline', () => setIsOnline(false));
    
    // Test Firestore connection
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        } else {
          handleFirestoreError(error, OperationType.GET, 'test/connection');
        }
      }
    };
    testConnection();

    // Auth Listener
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
      if (currentUser) {
        // Create/Update user profile
        const userRef = doc(db, 'users', currentUser.uid);
        await setDoc(userRef, {
          displayName: currentUser.displayName,
          photoURL: currentUser.photoURL,
          email: currentUser.email,
          createdAt: new Date().toISOString()
        }, { merge: true });
      }
    });

    if (!apiKey && !process.env.GEMINI_API_KEY) {
      setShowApiKeyModal(true);
    }

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctxRef.current = ctx;
      }
      resizeCanvas();
    }

    setAiBubble(MESSAGES[lang as keyof typeof MESSAGES]?.welcome || MESSAGES.en.welcome);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('online', () => setIsOnline(true));
      window.removeEventListener('offline', () => setIsOnline(false));
      unsubscribe();
    };
  }, []);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    
    const { width, height } = parent.getBoundingClientRect();
    const temp = ctxRef.current?.getImageData(0, 0, canvas.width, canvas.height);
    canvas.width = width;
    canvas.height = height;
    if (temp) ctxRef.current?.putImageData(temp, 0, 0);
    
    if (ctxRef.current) {
      ctxRef.current.lineCap = 'round';
      ctxRef.current.lineJoin = 'round';
    }
  }, []);

  useEffect(() => {
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [resizeCanvas]);

  // --- Auth Actions ---
  const login = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // --- Drawing Logic ---
  const saveUndo = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setUndoStack(prev => {
      const next = [...prev, canvas.toDataURL()];
      return next.slice(-20);
    });
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (aiDrawing) return;
    const { x, y } = getPos(e);
    saveUndo();
    isDrawingRef.current = true;
    lastPosRef.current = { x, y };
    pointsRef.current = [{ x, y }];
    lastMidPointRef.current = null;

    if (currentTool === 'fill') {
      floodFill(x, y, currentColor);
      isDrawingRef.current = false;
      playSound('click');
    } else if (currentTool === 'stamp') {
      drawStamp(x, y);
      isDrawingRef.current = false;
      playSound('click');
    } else if (currentTool === 'shapes') {
      shapeStartRef.current = { x, y };
      snapCanvasRef.current = ctxRef.current?.getImageData(0, 0, canvasRef.current!.width, canvasRef.current!.height) || null;
      playSound('click');
    } else if (currentTool === 'eraser') {
      playSound('erase');
    } else {
      playSound('draw');
    }
    
    setDrawCount(prev => prev + 1);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawingRef.current || aiDrawing) return;
    const { x, y } = getPos(e);
    const ctx = ctxRef.current;
    if (!ctx) return;

    if (currentTool === 'shapes' && shapeStartRef.current) {
      ctx.putImageData(snapCanvasRef.current!, 0, 0);
      const { x: sx, y: sy } = shapeStartRef.current;
      ctx.strokeStyle = currentColor;
      ctx.lineWidth = brushSize / 2;
      ctx.globalAlpha = opacity;
      ctx.fillStyle = currentColor + '44';
      ctx.beginPath();
      if (currentShape === 'rect') ctx.rect(sx, sy, x - sx, y - sy);
      else if (currentShape === 'circle') {
        const rx = Math.abs(x - sx) / 2;
        const ry = Math.abs(y - sy) / 2;
        ctx.ellipse(sx + (x - sx) / 2, sy + (y - sy) / 2, rx, ry, 0, 0, Math.PI * 2);
      } else if (currentShape === 'triangle') {
        ctx.moveTo(sx + (x - sx) / 2, sy);
        ctx.lineTo(x, y);
        ctx.lineTo(sx, y);
        ctx.closePath();
      } else if (currentShape === 'star') {
        const cx = sx + (x - sx) / 2;
        const cy = sy + (y - sy) / 2;
        const r = Math.min(Math.abs(x - sx), Math.abs(y - sy)) / 2;
        for (let i = 0; i < 5; i++) {
          ctx.lineTo(cx + r * Math.cos((18 + i * 72) / 180 * Math.PI), cy - r * Math.sin((18 + i * 72) / 180 * Math.PI));
          ctx.lineTo(cx + r / 2.5 * Math.cos((54 + i * 72) / 180 * Math.PI), cy - r / 2.5 * Math.sin((54 + i * 72) / 180 * Math.PI));
        }
        ctx.closePath();
      } else if (currentShape === 'heart') {
        const d = Math.min(Math.abs(x - sx), Math.abs(y - sy));
        ctx.moveTo(sx, sy + d / 4);
        ctx.quadraticCurveTo(sx, sy, sx + d / 4, sy);
        ctx.quadraticCurveTo(sx + d / 2, sy, sx + d / 2, sy + d / 4);
        ctx.quadraticCurveTo(sx + d / 2, sy, sx + d * 3 / 4, sy);
        ctx.quadraticCurveTo(sx + d, sy, sx + d, sy + d / 4);
        ctx.quadraticCurveTo(sx + d, sy + d / 2, sx + d / 2, sy + d);
        ctx.quadraticCurveTo(sx, sy + d / 2, sx, sy + d / 4);
      }
      ctx.stroke();
      ctx.fill();
      ctx.globalAlpha = 1;
      return;
    }

    ctx.lineWidth = currentTool === 'pen' ? brushSize / 3 + 1 : brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = opacity;

    if (currentTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = brushSize * 2;
      ctx.beginPath();
      ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    } else if (currentTool === 'spray') {
      ctx.globalAlpha = 0.4;
      for (let i = 0; i < 30; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * brushSize;
        ctx.beginPath();
        ctx.arc(x + r * Math.cos(a), y + r * Math.sin(a), 1, 0, Math.PI * 2);
        ctx.fillStyle = currentColor;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else if (currentTool === 'charcoal') {
      ctx.globalAlpha = 0.1 * opacity;
      for (let i = 0; i < 5; i++) {
        const ox = (Math.random() - 0.5) * brushSize;
        const oy = (Math.random() - 0.5) * brushSize;
        ctx.beginPath();
        ctx.moveTo(lastPosRef.current.x + ox, lastPosRef.current.y + oy);
        ctx.lineTo(x + ox, y + oy);
        ctx.strokeStyle = currentColor;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else if (currentTool === 'watercolor') {
      ctx.globalAlpha = 0.05 * opacity;
      ctx.beginPath();
      ctx.arc(x, y, brushSize * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = currentColor;
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (currentTool === 'rainbow') {
      rainbowHueRef.current = (rainbowHueRef.current + 5) % 360;
      ctx.strokeStyle = `hsl(${rainbowHueRef.current}, 100%, 55%)`;
      ctx.shadowColor = `hsl(${rainbowHueRef.current}, 100%, 60%)`;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else if (currentTool === 'glow') {
      ctx.strokeStyle = currentColor;
      ctx.shadowColor = currentColor;
      ctx.shadowBlur = 18;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    } else if (currentTool === 'brush' || currentTool === 'pen') {
      ctx.strokeStyle = currentColor;
      if (smoothBrush) {
        pointsRef.current.push({ x, y });
        if (pointsRef.current.length > 2) {
          const lastPoint = pointsRef.current[pointsRef.current.length - 2];
          const midPoint = {
            x: (lastPoint.x + x) / 2,
            y: (lastPoint.y + y) / 2
          };
          if (lastMidPointRef.current) {
            ctx.beginPath();
            ctx.moveTo(lastMidPointRef.current.x, lastMidPointRef.current.y);
            ctx.quadraticCurveTo(lastPoint.x, lastPoint.y, midPoint.x, midPoint.y);
            ctx.stroke();
          }
          lastMidPointRef.current = midPoint;
        }
      } else {
        ctx.beginPath();
        ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    } else {
      ctx.strokeStyle = currentColor;
      ctx.beginPath();
      ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    }

    lastPosRef.current = { x, y };
  };

  const stopDrawing = () => {
    if (isDrawingRef.current && smoothBrush && (currentTool === 'brush' || currentTool === 'pen')) {
      const ctx = ctxRef.current;
      if (ctx && lastMidPointRef.current && pointsRef.current.length > 0) {
        const lastPoint = pointsRef.current[pointsRef.current.length - 1];
        ctx.beginPath();
        ctx.moveTo(lastMidPointRef.current.x, lastMidPointRef.current.y);
        ctx.lineTo(lastPoint.x, lastPoint.y);
        ctx.stroke();
      }
    }
    isDrawingRef.current = false;
    shapeStartRef.current = null;
    pointsRef.current = [];
    lastMidPointRef.current = null;
    if (ctxRef.current) {
      ctxRef.current.shadowBlur = 0;
      ctxRef.current.globalAlpha = 1;
    }
  };

  const drawStamp = (x: number, y: number) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.save();
    ctx.font = `${brushSize * 2 + 18}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(activeStamp, x, y);
    ctx.restore();
  };

  const floodFill = (startX: number, startY: number, fillColor: string) => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const w = canvas.width;
    const h = canvas.height;

    const x = Math.round(startX);
    const y = Math.round(startY);
    const startPos = (y * w + x) * 4;
    const startR = data[startPos];
    const startG = data[startPos + 1];
    const startB = data[startPos + 2];

    const fillRGB = hexToRgb(fillColor);
    if (!fillRGB || (startR === fillRGB[0] && startG === fillRGB[1] && startB === fillRGB[2])) return;

    const stack = [[x, y]];
    const visited = new Set<number>();

    while (stack.length) {
      const [cx, cy] = stack.pop()!;
      if (cx < 0 || cx >= w || cy < 0 || cy >= h) continue;
      
      const pos = (cy * w + cx) * 4;
      if (visited.has(pos)) continue;
      
      if (Math.abs(data[pos] - startR) > 35 || 
          Math.abs(data[pos + 1] - startG) > 35 || 
          Math.abs(data[pos + 2] - startB) > 35) continue;

      visited.add(pos);
      data[pos] = fillRGB[0];
      data[pos + 1] = fillRGB[1];
      data[pos + 2] = fillRGB[2];
      data[pos + 3] = 255;

      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
    ctx.putImageData(imageData, 0, 0);
  };

  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16)
    ] : null;
  };

  const clearCanvas = () => {
    saveUndo();
    const ctx = ctxRef.current;
    if (ctx && canvasRef.current) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      playSound('whoosh');
    }
  };

  const undo = () => {
    if (undoStack.length === 0) return;
    playSound('click');
    const last = undoStack[undoStack.length - 1];
    const img = new Image();
    img.src = last;
    img.onload = () => {
      const ctx = ctxRef.current;
      if (ctx && canvasRef.current) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        ctx.drawImage(img, 0, 0);
      }
    };
    setUndoStack(prev => prev.slice(0, -1));
  };

  // --- AI Logic ---
  const getAI = useCallback(() => {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) return null;
    return new GoogleGenAI({ apiKey: key });
  }, [apiKey]);

  const callComplexAI = async (prompt: string) => {
    const ai = getAI();
    if (!ai) return null;
    return ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }
      }
    });
  };

  const callSearchAI = async (prompt: string) => {
    const ai = getAI();
    if (!ai) return null;
    return ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });
  };

  const aiLine = async (x1: number, y1: number, x2: number, y2: number, color: string, lw: number, steps = 30) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    for (let i = 1; i <= steps; i++) {
      const px = x1 + (x2 - x1) * (i / steps);
      const py = y1 + (y2 - y1) * (i / steps);
      if (i === 1) { ctx.beginPath(); ctx.moveTo(x1, y1); }
      ctx.lineTo(px, py);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(px, py);
      await new Promise(r => setTimeout(r, 12));
    }
  };

  const aiCircle = async (x: number, y: number, r: number, color: string, lw: number, fill?: string, steps = 40) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      ctx.lineTo(x + r * Math.cos(a - Math.PI / 2), y + r * Math.sin(a - Math.PI / 2));
      await new Promise(r => setTimeout(r, 8));
    }
    ctx.stroke();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const aiEllipse = async (x: number, y: number, rx: number, ry: number, color: string, lw: number, fill?: string) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    const steps = 40;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      ctx.lineTo(x + rx * Math.cos(a), y + ry * Math.sin(a));
      await new Promise(r => setTimeout(r, 8));
    }
    ctx.stroke();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const aiCurve = async (pts: [number, number][], color: string, lw: number) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pts[i][0], pts[i][1]);
      await new Promise(r => setTimeout(r, 14));
    }
  };

  const aiFill = async (x: number, y: number, r: number, color: string) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };

  // --- Drawing Programs ---
  const DRAWINGS: Record<string, DrawingProgram> = {
    cat: async (x, y, s) => {
      await aiEllipse(x, y + s * 40, s * 45, s * 35, '#FF851B', 4, '#FFD580');
      await aiCircle(x, y, s * 38, '#FF851B', 4, '#FFD580');
      await aiLine(x - s * 28, y - s * 28, x - s * 10, y - s * 44, '#FF851B', 4);
      await aiLine(x - s * 10, y - s * 44, x + s * 5, y - s * 28, '#FF851B', 4);
      await aiLine(x + s * 28, y - s * 28, x + s * 10, y - s * 44, '#FF851B', 4);
      await aiLine(x + s * 10, y - s * 44, x - s * 5, y - s * 28, '#FF851B', 4);
      await aiFill(x - s * 17, y - s * 36, s * 8, '#FFB6C1');
      await aiFill(x + s * 17, y - s * 36, s * 8, '#FFB6C1');
      await aiCircle(x - s * 14, y - s * 5, s * 8, '#333', 3, '#00BFFF');
      await aiFill(x - s * 14, y - s * 5, s * 4, '#111');
      await aiCircle(x + s * 14, y - s * 5, s * 8, '#333', 3, '#00BFFF');
      await aiFill(x + s * 14, y - s * 5, s * 4, '#111');
      await aiFill(x, y + s * 7, s * 5, '#FF69B4');
      await aiLine(x, y + s * 7, x - s * 10, y + s * 18, '#333', 2);
      await aiLine(x, y + s * 7, x + s * 10, y + s * 18, '#333', 2);
    },
    sun: async (x, y, s) => {
      await aiCircle(x, y, s * 60, '#FFD700', 5, '#FFEB3B');
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        await aiLine(x + Math.cos(a) * s * 65, y + Math.sin(a) * 65, x + Math.cos(a) * s * 90, y + Math.sin(a) * 90, '#FFD700', 5);
      }
      await aiCircle(x - s * 18, y - s * 12, s * 8, '#333', 3, '#333');
      await aiCircle(x + s * 18, y - s * 12, s * 8, '#333', 3, '#333');
      const smilePts: [number, number][] = [];
      for (let i = 0; i <= 20; i++) {
        const a = Math.PI * 0.1 + (i / 20) * Math.PI * 0.8;
        smilePts.push([x + s * 35 * Math.cos(a), y + s * 35 * Math.sin(a) + s * 10]);
      }
      await aiCurve(smilePts, '#333', 4);
    },
    house: async (x, y, s) => {
      const ctx = ctxRef.current;
      if (!ctx) return;
      ctx.fillStyle = '#FF851B';
      ctx.fillRect(x - s * 70, y - s * 20, s * 140, s * 100);
      await aiLine(x - s * 80, y - s * 20, x, y - s * 100, '#FF4136', 6);
      await aiLine(x, y - s * 100, x + s * 80, y - s * 20, '#FF4136', 6);
      ctx.fillStyle = '#8B4513';
      ctx.fillRect(x - s * 18, y + s * 40, s * 36, s * 40);
    },
    tree: async (x, y, s) => {
      const ctx = ctxRef.current;
      if (!ctx) return;
      ctx.fillStyle = '#8B4513';
      ctx.fillRect(x - s * 14, y + s * 10, s * 28, s * 90);
      await aiEllipse(x, y + s * 10, s * 70, s * 55, '#2d8a00', 4, '#4CAF50');
      await aiEllipse(x, y - s * 30, s * 55, s * 45, '#2d8a00', 4, '#4CAF50');
    },
    rainbow: async (x, y, s) => {
      const rc = ['#FF4136', '#FF851B', '#FFDC00', '#2ECC40', '#00BFFF', '#7B68EE', '#FF69B4'];
      const canvas = canvasRef.current!;
      const bx = canvas.width / 2;
      const by = canvas.height - s * 20;
      for (let i = 0; i < rc.length; i++) {
        const r = (canvas.height * 0.7) - (i * s * 18);
        const ctx = ctxRef.current!;
        ctx.strokeStyle = rc[i];
        ctx.lineWidth = s * 14;
        ctx.beginPath();
        ctx.arc(bx, by, r, Math.PI, 0);
        ctx.stroke();
        await new Promise(r => setTimeout(r, 80));
      }
    }
  };

  const triggerDraw = async (key: string) => {
    if (aiDrawing) return;
    setAiDrawing(true);
    saveUndo();
    playSound('magic');
    setAiStatus(MESSAGES[lang as keyof typeof MESSAGES]?.typing || MESSAGES.en.typing);
    setAiBubble(MESSAGES[lang as keyof typeof MESSAGES]?.drawing(key) || MESSAGES.en.drawing(key));
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const scale = Math.min(canvas.width, canvas.height) / 300;

    try {
      const drawFn = DRAWINGS[key] || learnedDrawings[key];
      if (drawFn) {
        await drawFn(cx, cy, scale);
        setAiBubble(MESSAGES[lang as keyof typeof MESSAGES]?.done(key) || MESSAGES.en.done(key));
      } else {
        setAiBubble(MESSAGES[lang as keyof typeof MESSAGES]?.noIdea || MESSAGES.en.noIdea);
      }
    } catch (e) {
      console.error(e);
      setAiBubble("Oops! Something went wrong while drawing.");
    } finally {
      setAiDrawing(false);
      setAiStatus('');
    }
  };

  const learnToDraw = async (target: string) => {
    if (!user) {
      setAiBubble("Please sign in to teach me new things! 🔑");
      return;
    }

    const ai = getAI();
    if (!ai) {
      setShowApiKeyModal(true);
      return;
    }

    setAiDrawing(true);
    setAiStatus(`Thinking hard about how to draw ${target}... 🧠`);
    
    try {
      const response = await callComplexAI(`You are a JavaScript code generator for a kids drawing app.
        Available ASYNC drawing helpers:
        - await aiLine(x1, y1, x2, y2, color, lineWidth)
        - await aiCircle(x, y, radius, color, lineWidth, fillColor)
        - await aiEllipse(x, y, rx, ry, color, lineWidth, fillColor)
        - await aiCurve(pointsArray, color, lineWidth)
        - await aiFill(x, y, radius, color)
        
        The canvas size is W() x H(). The center is at (x, y).
        The scale is 's'. Use 's' to multiply all coordinates and sizes (e.g., s * 50).
        
        Return ONLY the JavaScript code inside the function body to draw a ${target}. 
        Use multiple shapes and colors. Be creative!
        IMPORTANT: Use 'await' for all helper calls.
        Wrap the code in ===CODE_START=== and ===CODE_END===.
        Do NOT use any other variables or functions except the ones provided.
        Example:
        ===CODE_START===
        await aiCircle(x, y, s * 50, '#FF0000', 5, '#FFAAAA');
        await aiLine(x - s * 20, y - s * 20, x + s * 20, y + s * 20, '#000000', 2);
        ===CODE_END===`);
      
      const raw = response?.text;
      const codeMatch = raw?.match(/===CODE_START===([\s\S]*?)===CODE_END===/);
      const code = codeMatch ? codeMatch[1].trim() : raw;

      if (code) {
        const drawFn = new Function('aiLine', 'aiCircle', 'aiEllipse', 'aiCurve', 'aiFill', 'W', 'H', 'sleep',
          `return async function(x, y, s) {
            try {
              ${code}
            } catch(e) { console.error("AI Drawing Error:", e); }
          }`
        )(aiLine, aiCircle, aiEllipse, aiCurve, aiFill, () => canvasRef.current!.width, () => canvasRef.current!.height, (ms: number) => new Promise(r => setTimeout(r, ms)));

        setLearnedDrawings(prev => ({ ...prev, [target]: drawFn }));
        setLearnedNames(prev => [...new Set([...prev, target])]);
        playSound('success');
        
        // Save to Firestore (Private)
        try {
          await addDoc(collection(db, 'learned_items'), {
            userId: user.uid,
            name: target,
            code: code,
            createdAt: new Date().toISOString()
          });
        } catch (e) {
          handleFirestoreError(e, OperationType.WRITE, 'learned_items');
        }

        // Save to Firestore (Community/Training Data)
        try {
          await addDoc(collection(db, 'community_drawings'), {
            userId: user.uid,
            userName: user.displayName || 'Anonymous Artist',
            name: target,
            code: code,
            createdAt: new Date().toISOString()
          });
        } catch (e) {
          handleFirestoreError(e, OperationType.WRITE, 'community_drawings');
        }

        setAiBubble(MESSAGES[lang as keyof typeof MESSAGES]?.learned(target) || MESSAGES.en.learned(target));
      }
    } catch (e) {
      console.error(e);
      setAiBubble("I couldn't learn that right now. Maybe try again later?");
    } finally {
      setAiDrawing(false);
      setAiStatus('');
    }
  };

  const generateImage = async (prompt: string) => {
    const ai = getAI();
    if (!ai) {
      setShowApiKeyModal(true);
      return;
    }

    setAiStatus('AI is imagining... 🎨');
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [{ text: prompt }],
        },
        config: {
          imageConfig: {
            aspectRatio: "1:1",
          },
        },
      });

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const base64Data = part.inlineData.data;
          const img = new Image();
          img.onload = () => {
            saveUndo();
            const ctx = ctxRef.current!;
            const canvas = canvasRef.current!;
            const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
            ctx.drawImage(img, (canvas.width - img.width * scale) / 2, (canvas.height - img.height * scale) / 2, img.width * scale, img.height * scale);
            setAiBubble("I've added some AI magic to your canvas! ✨");
          };
          img.src = `data:image/png;base64,${base64Data}`;
          break;
        }
      }
    } catch (e) {
      console.error(e);
      setAiBubble("I couldn't imagine that right now. Try a different prompt!");
    } finally {
      setAiStatus('');
    }
  };

  const generateVideo = async () => {
    if (!user) {
      setAiBubble("Please sign in to animate your drawing! 🔑");
      return;
    }

    // Check if API key is selected via platform dialog (required for Veo)
    if (typeof window !== 'undefined' && window.aistudio) {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey) {
        setAiBubble("Please select a paid API key to use video generation! 🎬");
        await window.aistudio.openSelectKey();
        // After opening, we assume the user might have selected one and proceed
      }
    }

    const ai = getAI();
    if (!ai) {
      setShowApiKeyModal(true);
      return;
    }

    setIsVideoGenerating(true);
    setVideoProgress('Starting video generation...');
    
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const base64Image = canvas.toDataURL('image/png').split(',')[1];

      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: 'Bring this drawing to life with magical animations, vibrant colors, and playful movements for kids. Make it feel like a cartoon!',
        image: {
          imageBytes: base64Image,
          mimeType: 'image/png',
        },
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio: '16:9'
        }
      });

      while (!operation.done) {
        setVideoProgress('AI is animating... this takes a minute! ⏳');
        await new Promise(resolve => setTimeout(resolve, 10000));
        try {
          operation = await ai.operations.getVideosOperation({ operation });
        } catch (opErr: any) {
          if (opErr.message?.includes('not found')) {
            // Race condition or key issue, retry selection
            setAiBubble("Key selection issue. Please select your API key again.");
            if (window.aistudio) await window.aistudio.openSelectKey();
            throw opErr;
          }
          throw opErr;
        }
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (downloadLink) {
        const key = apiKey || process.env.GEMINI_API_KEY;
        const response = await fetch(downloadLink, {
          method: 'GET',
          headers: {
            'x-goog-api-key': key!,
          },
        });
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setVideoUrl(url);
        setAiBubble("Ta-da! Your drawing is now a video! 🎬✨");
      }
    } catch (e: any) {
      console.error(e);
      if (e.message?.includes('permission denied') || e.message?.includes('API key')) {
        setAiBubble("Permission denied! You need a paid API key for video generation. 🔑");
        if (window.aistudio) await window.aistudio.openSelectKey();
      } else {
        setAiBubble("Oops! Video generation failed. Try again!");
      }
    } finally {
      setIsVideoGenerating(false);
      setVideoProgress('');
    }
  };

  const saveDrawing = async () => {
    if (!user) {
      setAiBubble("Please sign in to save your drawings! 🔑");
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const imageData = canvas.toDataURL('image/png');

    try {
      setAiStatus('Saving your masterpiece... 💾');
      await addDoc(collection(db, 'drawings'), {
        userId: user.uid,
        title: `My Drawing ${new Date().toLocaleDateString()}`,
        imageData: imageData,
        createdAt: new Date().toISOString()
      });
      setAiBubble("Masterpiece saved to your account! 🌟");
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'drawings');
    } finally {
      setAiStatus('');
    }
  };

  const shareToCommunity = async () => {
    if (!user) {
      setAiBubble("Please sign in to share with the community! 🔑");
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const imageData = canvas.toDataURL('image/png');

    try {
      setAiStatus('Sharing with the world... 🌍');
      await addDoc(collection(db, 'community_drawings'), {
        userId: user.uid,
        userName: user.displayName || 'Anonymous Artist',
        name: `Masterpiece by ${user.displayName || 'Anonymous'}`,
        imageData: imageData,
        likesCount: 0,
        createdAt: new Date().toISOString()
      });
      setAiBubble("Shared! Your drawing is now in the Community tab! 🌟");
      playSound('success');
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'community_drawings');
    } finally {
      setAiStatus('');
    }
  };

  // --- Photo Editing & Community ---
  const applyFilters = () => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;

    saveUndo();
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d')!;
    
    const filterString = `brightness(${brightness}%) contrast(${contrast}%) grayscale(${grayscale}%) sepia(${sepia}%) invert(${invert}%) blur(${blur}px) hue-rotate(${hueRotate}deg) saturate(${saturate}%)`;
    tempCtx.filter = filterString;
    tempCtx.drawImage(canvas, 0, 0);
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(tempCanvas, 0, 0);
    playSound('magic');
    setAiBubble("Filters applied! ✨ Looking good!");
  };

  const resetFilters = () => {
    setBrightness(100);
    setContrast(100);
    setGrayscale(0);
    setSepia(0);
    setInvert(0);
    setBlur(0);
    setHueRotate(0);
    setSaturate(100);
  };

  const refineWithAI = async (prompt: string) => {
    const ai = getAI();
    if (!ai) {
      setShowApiKeyModal(true);
      return;
    }

    setAiDrawing(true);
    setAiStatus('AI is refining your masterpiece... 🎨✨');
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const base64Image = canvas.toDataURL('image/png').split(',')[1];

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            { inlineData: { data: base64Image, mimeType: 'image/png' } },
            { text: `Refine this drawing based on this prompt: ${prompt}. Keep the original composition but make it more detailed and professional.` }
          ],
        },
      });

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const base64Data = part.inlineData.data;
          const img = new Image();
          img.onload = () => {
            saveUndo();
            const ctx = ctxRef.current!;
            const canvas = canvasRef.current!;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            setAiBubble("I've refined your drawing with AI magic! 🪄✨");
          };
          img.src = `data:image/png;base64,${base64Data}`;
          break;
        }
      }
    } catch (e) {
      console.error(e);
      setAiBubble("I couldn't refine that right now. Try again!");
    } finally {
      setAiDrawing(false);
      setAiStatus('');
    }
  };

  const toggleLike = async (drawingId: string) => {
    if (!user) {
      setAiBubble("Please sign in to like drawings! ❤️");
      return;
    }

    if (isLiking[drawingId]) return;
    setIsLiking(prev => ({ ...prev, [drawingId]: true }));

    try {
      const likeRef = doc(db, 'community_drawings', drawingId, 'likes', user.uid);
      const likeDoc = await getDoc(likeRef);
      const drawingRef = doc(db, 'community_drawings', drawingId);

      if (likeDoc.exists()) {
        setAiBubble("You already liked this! ❤️");
      } else {
        const drawingSnap = await getDoc(drawingRef);
        const currentLikes = drawingSnap.data()?.likesCount || 0;
        await setDoc(drawingRef, { likesCount: currentLikes + 1 }, { merge: true });
        await setDoc(likeRef, { userId: user.uid, createdAt: new Date().toISOString() });
        playSound('click');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLiking(prev => ({ ...prev, [drawingId]: false }));
    }
  };

  const fetchComments = (drawingId: string) => {
    const q = query(collection(db, 'community_drawings', drawingId, 'comments'), orderBy('createdAt', 'desc'), limit(50));
    return onSnapshot(q, (snapshot) => {
      const newComments: Comment[] = [];
      snapshot.forEach((doc) => {
        newComments.push({ id: doc.id, ...doc.data() } as Comment);
      });
      setComments(newComments);
    });
  };

  const addComment = async (drawingId: string, text: string) => {
    if (!user) {
      setAiBubble("Please sign in to comment! 💬");
      return;
    }
    if (!text.trim()) return;

    try {
      await addDoc(collection(db, 'community_drawings', drawingId, 'comments'), {
        userId: user.uid,
        userName: user.displayName || 'Anonymous',
        userPhoto: user.photoURL,
        text,
        createdAt: new Date().toISOString()
      });
      playSound('click');
    } catch (e) {
      console.error(e);
    }
  };

  const downloadImage = () => {
    const link = document.createElement('a');
    link.download = 'my-painting.png';
    link.href = canvasRef.current!.toDataURL();
    link.click();
  };

  const handleChat = async (text: string) => {
    const ai = getAI();
    if (!ai) {
      setShowApiKeyModal(true);
      return;
    }

    try {
      const response = await ai.models.generateContent({
        model: appMode === 'kids' ? "gemini-3-flash-preview" : "gemini-3.1-pro-preview",
        contents: text,
        config: {
          systemInstruction: appMode === 'kids' 
            ? "You are a friendly AI drawing assistant for kids. Keep your answers short, fun, and encouraging. Use emojis! If the user asks to draw something, tell them to type it in the drawing box or use the Learn tab."
            : "You are a professional art assistant. Provide detailed, insightful advice on composition, color theory, and artistic techniques. Be encouraging but sophisticated. Use markdown for formatting.",
          thinkingConfig: appMode === 'advanced' ? { thinkingLevel: ThinkingLevel.HIGH } : undefined
        }
      });
      
      const reply = response.text || "I'm not sure what to say, but keep drawing! 🎨";
      setChatHistory(prev => [...prev, { role: 'model', text: reply }]);
      playSound('click');
    } catch (e) {
      console.error(e);
      setChatHistory(prev => [...prev, { role: 'model', text: "Oops! My brain is a bit fuzzy right now. 😵‍💫" }]);
    }
  };

  const handleAIInput = async (text: string) => {
    // Offline AI Fallback
    if (!isOnline) {
      const lowerText = text.toLowerCase();
      const drawable = DRAWABLES.find(d => lowerText.includes(d.key));
      if (drawable) {
        triggerDraw(drawable.key);
        setAiBubble(`I'm working offline! I found "${drawable.key}" in your request. ✨`);
      } else {
        setAiBubble("I'm offline right now, so I can only draw simple things like cats, dogs, or houses if you mention them! 📶");
      }
      return;
    }

    const ai = getAI();
    if (!ai) {
      setShowApiKeyModal(true);
      return;
    }

    setAiDrawing(true);
    setAiStatus('AI is thinking...');
    
    try {
      const response = await ai.models.generateContent({
        model: appMode === 'kids' ? "gemini-3-flash-preview" : "gemini-3.1-pro-preview",
        contents: text,
        config: {
          systemInstruction: `You are a drawing assistant. The user wants to draw something. 
          Analyze the user's request: "${text}".
          If they want to draw one of these: cat, dog, house, tree, rainbow, sun, flower, rocket, fish, butterfly, star, dinosaur, car.
          Return ONLY the key name (e.g., "cat").
          If it's not in the list, return "unknown".`,
          thinkingConfig: appMode === 'advanced' ? { thinkingLevel: ThinkingLevel.HIGH } : undefined
        }
      });
      
      const result = response.text?.toLowerCase().trim();
      const drawable = DRAWABLES.find(d => result?.includes(d.key));
      
      if (drawable) {
        triggerDraw(drawable.key);
      } else {
        setAiBubble(MESSAGES[lang as keyof typeof MESSAGES]?.noIdea || MESSAGES.en.noIdea);
      }
    } catch (e) {
      console.error(e);
      setAiBubble("I'm having trouble connecting to my brain right now!");
    } finally {
      setAiDrawing(false);
      setAiStatus('');
    }
  };

  const getSearchTip = async (topic: string) => {
    setAiDrawing(true);
    setAiStatus('Searching for inspiration... 🔍');
    try {
      const response = await callSearchAI(`Give a fun, creative drawing tip for kids about ${topic}. Use Google Search to find interesting facts or techniques.`);
      setAiBubble(response?.text || "I couldn't find anything new, but keep drawing!");
    } catch (e) {
      console.error(e);
      setAiBubble("Search is a bit slow right now, try again!");
    } finally {
      setAiDrawing(false);
      setAiStatus('');
    }
  };

  // --- Render ---
  return (
    <ErrorBoundary>
      <div className={cn(
        "flex flex-col min-h-screen font-sans text-[#222] transition-colors duration-500",
        appMode === 'kids' ? "bg-[#f0f4ff]" : "bg-[#1a1a2e] text-white"
      )}>
      <AnimatePresence>
        {loading && (
          <motion.div 
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-gradient-to-br from-[#7c6cf8] via-[#ff6b9d] to-[#00d2ff] flex flex-col items-center justify-center"
          >
            <motion.div 
              animate={{ y: [0, -12, 0], scale: [1, 1.08, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="text-6xl mb-4"
            >
              🚀
            </motion.div>
            <h1 className="font-fredoka text-4xl text-white drop-shadow-lg mb-2">ScribbleDash</h1>
            <p className="text-white/85 font-bold mb-8">by Nova Studios ✨</p>
            <div className="w-[220px] h-3.5 bg-white/30 rounded-full overflow-hidden mb-4">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{ duration: 2 }}
                className="h-full bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)]"
              />
            </div>
            <p className="text-white font-bold text-sm">Getting brushes ready...</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* API Key Modal */}
      {showApiKeyModal && (
        <div className="fixed inset-0 z-[10000] bg-black/55 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl">
            <h2 className="font-fredoka text-2xl text-[#7c6cf8] mb-2">🔑 Google AI API Key</h2>
            <p className="text-xs text-gray-600 font-bold leading-relaxed mb-4">
              The 🧠 Self-Learning, 💬 Chat and 🔍 Analyze features use Google Gemini AI.
              Get your free key at aistudio.google.com.
            </p>
            <input 
              type="password" 
              placeholder="AIzaSy..." 
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full p-3 rounded-2xl border-2 border-gray-200 font-bold focus:border-[#7c6cf8] outline-none mb-4"
            />
            <button 
              onClick={() => {
                localStorage.setItem('gemini_api_key', apiKey);
                setShowApiKeyModal(false);
              }}
              className="w-full p-3 rounded-2xl bg-[#7c6cf8] text-white font-extrabold hover:bg-[#534AB7] transition-all"
            >
              ✅ Save Key & Start Drawing!
            </button>
            <button 
              onClick={() => setShowApiKeyModal(false)}
              className="w-full mt-2 text-xs text-gray-400 font-bold hover:text-[#7c6cf8]"
            >
              ⏭️ Skip for now
            </button>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className={cn(
        "flex items-center gap-2 p-2 border-b-2 flex-wrap shadow-sm transition-all",
        appMode === 'kids' ? "bg-white border-[#e0e0ff]" : "bg-[#16213e] border-[#0f3460]"
      )}>
        <div className={cn(
          "flex gap-1 items-center p-1 rounded-2xl border transition-all",
          appMode === 'kids' ? "bg-[#f8f8ff] border-[#e8e6ff]" : "bg-[#0f3460] border-[#1a1a2e]"
        )}>
          <ToolButton icon={Brush} active={currentTool === 'brush'} onClick={() => { setCurrentTool('brush'); playSound('click'); }} title="Brush" mode={appMode} />
          <ToolButton icon={Pen} active={currentTool === 'pen'} onClick={() => { setCurrentTool('pen'); playSound('click'); }} title="Pen" mode={appMode} />
          {appMode === 'advanced' && (
            <>
              <ToolButton icon={Feather} active={currentTool === 'charcoal'} onClick={() => { setCurrentTool('charcoal'); playSound('click'); }} title="Charcoal" mode={appMode} />
              <ToolButton icon={Droplets} active={currentTool === 'watercolor'} onClick={() => { setCurrentTool('watercolor'); playSound('click'); }} title="Watercolor" mode={appMode} />
            </>
          )}
          <ToolButton icon={Wind} active={currentTool === 'spray'} onClick={() => { setCurrentTool('spray'); playSound('click'); }} title="Spray" mode={appMode} />
          <ToolButton icon={CloudRain} active={currentTool === 'rainbow'} onClick={() => { setCurrentTool('rainbow'); playSound('click'); }} title="Rainbow" mode={appMode} />
          <ToolButton icon={Sparkles} active={currentTool === 'glow'} onClick={() => { setCurrentTool('glow'); playSound('click'); }} title="Glow" mode={appMode} />
          <ToolButton icon={Eraser} active={currentTool === 'eraser'} onClick={() => { setCurrentTool('eraser'); playSound('click'); }} title="Eraser" mode={appMode} />
          <ToolButton icon={Palette} active={currentTool === 'fill'} onClick={() => { setCurrentTool('fill'); playSound('click'); }} title="Fill" mode={appMode} />
          <ToolButton icon={Square} active={currentTool === 'shapes'} onClick={() => {
            playSound('click');
            if (currentTool === 'shapes') {
              const shapes: Shape[] = ['rect', 'circle', 'triangle', 'star', 'heart', 'cloud'];
              const idx = shapes.indexOf(currentShape);
              setCurrentShape(shapes[(idx + 1) % shapes.length]);
            } else {
              setCurrentTool('shapes');
            }
          }} title="Shapes" mode={appMode} />
        </div>

        <div className={cn(
          "flex gap-2 items-center p-1 rounded-2xl border transition-all",
          appMode === 'kids' ? "bg-[#f8f8ff] border-[#e8e6ff]" : "bg-[#0f3460] border-[#1a1a2e]"
        )}>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold opacity-60">SIZE</span>
              <input 
                type="range" 
                min="2" 
                max="100" 
                value={brushSize} 
                onChange={(e) => setBrushSize(parseInt(e.target.value))}
                className="w-16 accent-[#7c6cf8]"
              />
              <span className="text-[10px] font-bold min-w-[16px]">{brushSize}</span>
            </div>
            {appMode === 'advanced' && (
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold opacity-60">OPACITY</span>
                <input 
                  type="range" 
                  min="0.1" 
                  max="1" 
                  step="0.1"
                  value={opacity} 
                  onChange={(e) => setOpacity(parseFloat(e.target.value))}
                  className="w-16 accent-[#ff6b9d]"
                />
                <span className="text-[10px] font-bold min-w-[16px]">{Math.round(opacity * 100)}%</span>
              </div>
            )}
          </div>
          <div className="h-6 w-[1px] bg-gray-200 mx-1 opacity-20" />
          <button 
            onClick={() => { setSmoothBrush(!smoothBrush); playSound('click'); }}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-xl text-[10px] font-extrabold transition-all",
              smoothBrush ? "bg-[#7c6cf8] text-white shadow-md" : "bg-white/10 text-gray-400 border border-gray-200/20"
            )}
            title="Smooth Brush"
          >
            {smoothBrush ? "✨ Smooth" : "〰️ Normal"}
          </button>
        </div>

        <div className="flex-1" />

        <div className="flex gap-2 items-center">
          <div className={cn(
            "flex items-center gap-1 p-1 rounded-2xl border transition-all",
            appMode === 'kids' ? "bg-[#f8f8ff] border-[#e8e6ff]" : "bg-[#0f3460] border-[#1a1a2e]"
          )}>
            <button 
              onClick={() => { setAppMode('kids'); playSound('click'); }}
              className={cn(
                "px-3 py-1.5 rounded-xl text-[10px] font-black transition-all flex items-center gap-1",
                appMode === 'kids' ? "bg-white text-[#7c6cf8] shadow-sm" : "text-gray-400 hover:text-white"
              )}
            >
              🍭 Kids
            </button>
            <button 
              onClick={() => { setAppMode('advanced'); playSound('click'); }}
              className={cn(
                "px-3 py-1.5 rounded-xl text-[10px] font-black transition-all flex items-center gap-1",
                appMode === 'advanced' ? "bg-[#7c6cf8] text-white shadow-sm" : "text-gray-400 hover:text-white"
              )}
            >
              ⚡ Advanced
            </button>
          </div>
        </div>

        <div className="flex gap-1 items-center p-1 bg-[#f8f8ff] rounded-2xl border border-[#e8e6ff] flex-wrap max-w-[200px]">
          {COLORS.map(c => (
            <button 
              key={c}
              onClick={() => setCurrentColor(c)}
              className={cn(
                "w-6 h-6 rounded-full border-2 border-transparent transition-all hover:scale-125 shadow-sm",
                currentColor === c && "border-black scale-110 ring-2 ring-white"
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        <div className="flex gap-1 items-center p-1 bg-[#f8f8ff] rounded-2xl border border-[#e8e6ff]">
          <ToolButton icon={Undo} onClick={undo} title="Undo" mode={appMode} />
          <ToolButton icon={Trash2} onClick={clearCanvas} title="Clear" mode={appMode} />
          <ToolButton icon={Download} onClick={downloadImage} title="Download" mode={appMode} />
          <ToolButton icon={Save} onClick={saveDrawing} title="Save to Cloud" mode={appMode} />
          <ToolButton icon={Globe} onClick={shareToCommunity} title="Share to Community" mode={appMode} />
          <ToolButton icon={Search} onClick={() => setActiveTab('tips')} title="Analyze" mode={appMode} />
        </div>
      </div>

      {/* Main Content */}
      <div className="relative flex-1 bg-white overflow-hidden">
        <canvas 
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="block touch-none cursor-crosshair"
        />
        
        {/* Stamps Panel */}
        <div className="absolute right-3 top-3 bg-white rounded-2xl p-2 shadow-xl border border-[#e8e6ff] flex flex-col gap-1">
          <span className="text-[9px] text-gray-400 text-center font-extrabold uppercase">Stamps</span>
          <div className="flex flex-col gap-1 max-h-[300px] overflow-y-auto pr-1 scrollbar-hide">
            {STAMPS.map(s => (
              <button 
                key={s}
                onClick={() => {
                  setCurrentTool('stamp');
                  setActiveStamp(s);
                }}
                className={cn(
                  "w-10 h-10 text-xl rounded-xl border-none bg-[#f8f8ff] hover:scale-110 hover:bg-[#f0edff] transition-all",
                  currentTool === 'stamp' && activeStamp === s && "bg-[#f0edff] ring-2 ring-[#7c6cf8]"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* AI Panel */}
      <div className="bg-white border-t-2 border-[#e0e0ff] p-3 shadow-lg">
        <div className="flex items-center gap-3 mb-3">
          <div className="relative w-10 h-10">
            <div className="absolute inset-[-4px] rounded-full border-2 border-[#7c6cf8] opacity-0 animate-pulse" />
            <div className="w-10 h-10 bg-gradient-to-br from-[#7c6cf8] to-[#ff6b9d] rounded-full flex items-center justify-center text-xl shadow-lg animate-bounce-slow">
              {aiDrawing ? '✏️' : '🤖'}
            </div>
          </div>
          <div className="flex-1">
            <h3 className="font-fredoka text-sm text-[#7c6cf8] tracking-wide">ScribbleDash Brain 🧠✨</h3>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-400 font-bold">by Nova Studios</span>
              <div className={cn(
                "flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold border transition-all",
                isOnline ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200 animate-pulse"
              )}>
                {isOnline ? <Wifi size={10} /> : <WifiOff size={10} />}
                {isOnline ? 'AI Online' : 'Offline Mode (Limited AI)'}
              </div>
            </div>
          </div>
          <div className="flex gap-1">
            {deferredPrompt && (
              <button 
                onClick={installApp}
                className="px-3 py-1.5 rounded-xl bg-green-500 text-white text-[10px] font-extrabold hover:bg-green-600 transition-all mr-2 flex items-center gap-1"
              >
                <Download size={12} /> Download App
              </button>
            )}
            <button 
              onClick={() => setIsMuted(!isMuted)} 
              className="w-8 h-8 rounded-full bg-white border border-[#e0e0ff] flex items-center justify-center hover:bg-gray-50 transition-all mr-2"
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <WifiOff size={14} className="text-red-400" /> : <Wifi size={14} className="text-[#7c6cf8]" />}
            </button>
            {user ? (
              <div className="flex items-center gap-2 mr-2">
                <img src={user.photoURL || ''} alt={user.displayName || ''} className="w-8 h-8 rounded-full border border-[#7c6cf8]" />
                <button onClick={logout} className="px-3 py-1.5 rounded-xl bg-gray-100 text-gray-600 text-[10px] font-extrabold hover:bg-gray-200 transition-all">Logout</button>
              </div>
            ) : (
              <button onClick={login} className="px-3 py-1.5 rounded-xl bg-[#7c6cf8] text-white text-[10px] font-extrabold hover:bg-[#534AB7] transition-all mr-2">Login with Google</button>
            )}
            {(['en', 'si', 'ta', 'hi', 'fr', 'es'] as Lang[]).map(l => (
              <button 
                key={l}
                onClick={() => setLang(l)}
                className={cn(
                  "px-2 py-1 rounded-xl border-1.5 border-[#7c6cf8] text-[10px] font-extrabold bg-white text-[#7c6cf8] hover:bg-[#7c6cf8] hover:text-white transition-all",
                  lang === l && "bg-[#7c6cf8] text-white"
                )}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-3 overflow-x-auto scrollbar-hide">
          <TabButton active={activeTab === 'draw'} onClick={() => setActiveTab('draw')} icon={Brush} label="Draw" mode={appMode} />
          <TabButton active={activeTab === 'chat'} onClick={() => setActiveTab('chat')} icon={MessageCircle} label="Chat" mode={appMode} />
          <TabButton active={activeTab === 'learn'} onClick={() => setActiveTab('learn')} icon={Brain} label="Learn" mode={appMode} />
          <TabButton active={activeTab === 'tips'} onClick={() => setActiveTab('tips')} icon={Lightbulb} label="Tips" mode={appMode} />
          <TabButton active={activeTab === 'tutorial'} onClick={() => setActiveTab('tutorial')} icon={BookOpen} label="Tutorial" mode={appMode} />
          <TabButton active={activeTab === 'photo-edit'} onClick={() => setActiveTab('photo-edit')} icon={Palette} label="Edit Photo" mode={appMode} />
          <TabButton active={activeTab === 'community'} onClick={() => setActiveTab('community')} icon={Users} label="Community" mode={appMode} />
          <TabButton active={activeTab === 'video'} onClick={() => setActiveTab('video')} icon={Sparkles} label="Video" mode={appMode} />
          {appMode === 'advanced' && (
            <TabButton active={activeTab === 'ai-gen'} onClick={() => setActiveTab('ai-gen')} icon={Wand2} label="AI Imagine" mode={appMode} />
          )}
          <TabButton active={activeTab === 'upload'} onClick={() => setActiveTab('upload')} icon={Upload} label="Upload" mode={appMode} />
        </div>

        {/* Tab Content */}
        <div className="min-h-[120px]">
          {activeTab === 'draw' && (
            <div className="space-y-2">
              <div className="flex gap-1 flex-wrap">
                <span className="text-[11px] text-gray-400 font-extrabold self-center mr-1">🤖 AI Draw:</span>
                {DRAWABLES.map(d => (
                  <button 
                    key={d.key}
                    onClick={() => triggerDraw(d.key)}
                    className="px-3 py-1.5 rounded-full bg-[#e8f8e8] text-[#1a6b1a] text-xs font-bold hover:scale-105 transition-all flex items-center gap-1"
                  >
                    <d.icon size={12} /> {d.label.split(' ')[1]}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder='Try: "draw a cat" or "surprise me"'
                  className="flex-1 p-2.5 rounded-2xl border-2 border-gray-200 text-sm font-bold focus:border-[#7c6cf8] outline-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAIInput(e.currentTarget.value);
                  }}
                />
                <button 
                  onClick={(e) => {
                    const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                    handleAIInput(input.value);
                  }}
                  className="px-5 py-2.5 rounded-2xl bg-[#7c6cf8] text-white font-extrabold hover:bg-[#534AB7] transition-all"
                >
                  Go 🧠
                </button>
              </div>
              <div className="relative p-3 bg-gradient-to-br from-[#f8f0ff] to-[#f0f4ff] rounded-2xl border border-[#e0d0ff] text-sm font-bold">
                <div className="absolute -top-2 left-4 w-4 h-4 bg-[#f8f0ff] border-l border-t border-[#e0d0ff] rotate-45" />
                {aiStatus && <div className="text-xs text-[#7c6cf8] animate-pulse mb-1">✏️ {aiStatus}</div>}
                <p>{aiBubble}</p>
              </div>
            </div>
          )}

          {activeTab === 'chat' && (
            <div className="space-y-2">
              <div className="max-h-[100px] overflow-y-auto space-y-2 mb-2 p-1">
                {chatHistory.map((msg, i) => (
                  <div key={i} className={cn(
                    "p-2 rounded-2xl text-xs font-bold max-w-[85%]",
                    msg.role === 'user' ? "bg-[#e8f0ff] ml-auto rounded-br-none" : "bg-[#f0edff] border border-[#e0d0ff] rounded-bl-none"
                  )}>
                    {msg.text}
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Ask me anything about drawing..."
                  className="flex-1 p-2.5 rounded-2xl border-2 border-gray-200 text-sm font-bold focus:border-[#7c6cf8] outline-none"
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter') {
                      const text = e.currentTarget.value;
                      if (!text.trim()) return;
                      e.currentTarget.value = '';
                      setChatHistory(prev => [...prev, { role: 'user', text }]);
                      handleChat(text);
                    }
                  }}
                />
                <button className="px-5 py-2.5 rounded-2xl bg-[#7c6cf8] text-white font-extrabold hover:bg-[#534AB7] transition-all">
                  Send 💬
                </button>
              </div>
            </div>
          )}

          {activeTab === 'learn' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[#7c6cf8] font-bold text-xs">
                <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                Ready to discover new things to draw!
              </div>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  id="learn-input"
                  placeholder="e.g. elephant, rocket, castle" 
                  className="flex-1 p-2.5 rounded-2xl border-2 border-gray-200 text-sm font-bold focus:border-[#7c6cf8] outline-none"
                />
                <button 
                  onClick={() => {
                    const input = document.getElementById('learn-input') as HTMLInputElement;
                    if (input.value) learnToDraw(input.value);
                  }}
                  className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-extrabold hover:scale-105 transition-all shadow-md"
                >
                  Learn It! 📚
                </button>
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-extrabold text-gray-500">🌟 Things I've Learned:</span>
                <div className="flex gap-1.5 flex-wrap">
                  {learnedNames.length === 0 && <span className="text-[10px] text-gray-400 italic">Nothing yet! Teach me something!</span>}
                  {learnedNames.map(name => (
                    <button 
                      key={name}
                      onClick={() => triggerDraw(name)}
                      className="px-3 py-1 rounded-full bg-[#fff0ff] border border-[#e0a0e0] text-[#8b0066] text-[11px] font-bold hover:scale-105 transition-all"
                    >
                      ✨ {name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'tips' && (
            <div className="space-y-3">
              <div className="p-3 bg-[#f8f8ff] rounded-2xl border border-[#e0d8ff] text-xs font-bold leading-relaxed text-gray-600">
                💡 Click a button below to get AI-powered tips!
              </div>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => setAiBubble("🎨 Try mixing the rainbow brush with stamps for magic!")} className="px-3 py-1.5 rounded-full bg-[#f0edff] text-[#7c6cf8] text-[11px] font-extrabold hover:scale-105 transition-all">🎨 Color Tips</button>
                <button onClick={() => setAiBubble("🖌️ Use the glow tool on your drawing to make it shine!")} className="px-3 py-1.5 rounded-full bg-[#f0edff] text-[#7c6cf8] text-[11px] font-extrabold hover:scale-105 transition-all">🖌️ Techniques</button>
                <button onClick={() => setAiBubble("📐 Put the main thing in the middle! Add a background first!")} className="px-3 py-1.5 rounded-full bg-[#f0edff] text-[#7c6cf8] text-[11px] font-extrabold hover:scale-105 transition-all">📐 Composition</button>
                <button onClick={() => setAiBubble("🐉 Draw a dragon eating ice cream! 🦸 Draw yourself as a superhero!")} className="px-3 py-1.5 rounded-full bg-[#fff0e0] text-[#b85000] text-[11px] font-extrabold hover:scale-105 transition-all">💡 Inspire Me!</button>
                <button 
                  onClick={() => {
                    const topic = prompt("What do you want to learn about? (e.g. space, dinosaurs, ocean)");
                    if (topic) getSearchTip(topic);
                  }}
                  className="px-3 py-1.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200 text-[11px] font-extrabold hover:scale-105 transition-all flex items-center gap-1"
                >
                  <Globe size={12} /> Search for Ideas
                </button>
              </div>
            </div>
          )}

          {activeTab === 'video' && (
            <div className="space-y-4">
              <div className="p-4 bg-gradient-to-br from-[#f8f0ff] to-[#f0f4ff] rounded-2xl border-2 border-[#e0d0ff] shadow-sm">
                <h3 className="font-fredoka text-lg text-[#7c6cf8] mb-2 flex items-center gap-2">
                  <Sparkles size={20} /> ScribbleDash Video Magic ✨
                </h3>
                <p className="text-xs font-bold text-gray-600 mb-4">
                  Turn your masterpiece or a photo into a magical video! Our AI will bring your drawing to life.
                </p>

                <div className="flex flex-col gap-3 mb-4">
                  <div className="relative border-2 border-dashed border-[#c0b8f8] rounded-xl p-4 text-center bg-white/50 hover:bg-white transition-all cursor-pointer">
                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          const img = new Image();
                          img.onload = () => {
                            saveUndo();
                            const ctx = ctxRef.current!;
                            const canvas = canvasRef.current!;
                            const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
                            ctx.clearRect(0, 0, canvas.width, canvas.height);
                            ctx.drawImage(img, (canvas.width - img.width * scale) / 2, (canvas.height - img.height * scale) / 2, img.width * scale, img.height * scale);
                            setAiBubble("Photo uploaded! Now click 'Animate' to bring it to life! 🎬");
                          };
                          img.src = ev.target?.result as string;
                        };
                        reader.readAsDataURL(file);
                      }
                    }} />
                    <div className="text-2xl mb-1">📸</div>
                    <div className="text-[10px] font-black text-[#7c6cf8]">Upload a Photo to Animate</div>
                  </div>
                </div>
                
                <button 
                  onClick={generateVideo}
                  disabled={isVideoGenerating}
                  className={cn(
                    "w-full py-4 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-3 shadow-lg",
                    isVideoGenerating 
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed" 
                      : "bg-gradient-to-r from-[#ff6b9d] to-[#7c6cf8] text-white hover:scale-[1.02] active:scale-95"
                  )}
                >
                  {isVideoGenerating ? <RefreshCw size={24} className="animate-spin" /> : <Sparkles size={24} />}
                  {isVideoGenerating ? "Creating Magic..." : "Animate My Drawing!"}
                </button>

                {isVideoGenerating && (
                  <div className="mt-6 text-center">
                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: '100%' }}
                        transition={{ duration: 30, ease: "linear" }}
                        className="h-full bg-gradient-to-r from-[#ff6b9d] to-[#7c6cf8]"
                      />
                    </div>
                    <div className="text-sm font-black text-[#7c6cf8] animate-pulse">{videoProgress}</div>
                  </div>
                )}

                {videoUrl && !isVideoGenerating && (
                  <div className="mt-6 space-y-3">
                    <div className="aspect-video rounded-2xl overflow-hidden border-4 border-white shadow-xl bg-black">
                      <video src={videoUrl} controls autoPlay loop className="w-full h-full object-contain" />
                    </div>
                    <a 
                      href={videoUrl} 
                      download="my-scribbledash-video.mp4"
                      className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[#7c6cf8] text-white font-black text-sm hover:bg-[#6b5ce0] transition-all"
                    >
                      <Download size={18} /> Download Video
                    </a>
                  </div>
                )}
              </div>

              <div className="p-4 bg-white rounded-2xl border border-gray-100 text-center">
                <div className="text-2xl mb-2">🎬</div>
                <div className="text-xs font-bold text-gray-400">
                  Tip: Draw something clear like a cat or a house for the best animation!
                </div>
              </div>
            </div>
          )}
          {activeTab === 'tutorial' && (
            <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1 scrollbar-hide">
              <TutorialCard 
                title="🐱 How to Draw a Cat" 
                desc="Learn to draw a cute cat step by step!" 
                steps={['Draw a big circle for the head.', 'Add two triangle ears on top.', 'Draw two oval eyes.', 'Add a tiny triangle nose.', 'Draw whiskers.']}
              />
              <TutorialCard 
                title="🌈 How to Draw a Rainbow" 
                desc="Make a colorful arc in the sky!" 
                steps={['Draw a big arch.', 'Draw more arches inside.', 'Color each arch differently.', 'Add white fluffy clouds.']}
              />
              <TutorialCard 
                title="🧠 How to Teach AI" 
                desc="Teach the AI to draw anything you want!" 
                steps={['Go to the "Learn" tab.', 'Type something like "elephant" or "castle".', 'Click "Learn It!".', 'Wait for the AI to think.', 'Click the new button to watch it draw!']}
              />
              <TutorialCard 
                title="🎬 Make an AI Video" 
                desc="Turn your drawing into a movie!" 
                steps={['Draw something on the canvas.', 'Click the "Make a Video!" button.', 'Wait for the AI to animate it.', 'Watch your movie!']}
              />
              {deferredPrompt && (
                <div className="mt-4 p-4 bg-green-50 rounded-2xl border-2 border-green-200 text-center">
                  <div className="text-2xl mb-2">📲</div>
                  <div className="text-sm font-black text-green-700 mb-1">Install ScribbleDash!</div>
                  <div className="text-[11px] text-green-600 font-bold mb-3">Get the app on your home screen for easy access!</div>
                  <button 
                    onClick={installApp}
                    className="px-6 py-2.5 rounded-2xl bg-green-500 text-white font-extrabold hover:bg-green-600 transition-all shadow-md flex items-center gap-2 mx-auto"
                  >
                    <Download size={16} /> Install Now
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'community' && (
            <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1 scrollbar-hide">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {communityItems.map((item) => (
                  <div 
                    key={item.id}
                    className="p-2 rounded-xl bg-[#f8f8ff] border border-[#e8e6ff] hover:border-[#7c6cf8] transition-all text-left group flex flex-col"
                  >
                    <button 
                      onClick={() => {
                        if (item.code) {
                          const drawFn = new Function('aiLine', 'aiCircle', 'aiEllipse', 'aiCurve', 'aiFill', 'W', 'H', 'sleep',
                            `return async function(x, y, s) {
                              try {
                                ${item.code}
                              } catch(e) { console.error("AI Drawing Error:", e); }
                            }`
                          )(aiLine, aiCircle, aiEllipse, aiCurve, aiFill, () => canvasRef.current!.width, () => canvasRef.current!.height, (ms: number) => new Promise(r => setTimeout(r, ms)));
                          
                          setLearnedDrawings(prev => ({ ...prev, [item.name]: drawFn }));
                          triggerDraw(item.name);
                        } else if (item.imageData) {
                          const img = new Image();
                          img.onload = () => {
                            saveUndo();
                            const ctx = ctxRef.current!;
                            const canvas = canvasRef.current!;
                            const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
                            ctx.drawImage(img, (canvas.width - img.width * scale) / 2, (canvas.height - img.height * scale) / 2, img.width * scale, img.height * scale);
                            setAiBubble(`Loaded masterpiece by ${item.userName}! 🎨`);
                          };
                          img.src = item.imageData;
                        }
                      }}
                      className="w-full"
                    >
                      {item.imageData ? (
                        <div className="aspect-square rounded-lg overflow-hidden mb-2 bg-white border border-gray-100">
                          <img src={item.imageData} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                        </div>
                      ) : (
                        <div className="aspect-square rounded-lg overflow-hidden mb-2 bg-gradient-to-br from-[#f0edff] to-[#fff0e0] flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                          🧠
                        </div>
                      )}
                      <div className="text-[10px] font-extrabold text-[#7c6cf8] truncate">✨ {item.name}</div>
                      <div className="text-[8px] text-gray-400 font-bold truncate">by {item.userName}</div>
                    </button>
                    
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                      <button 
                        onClick={(e) => { e.stopPropagation(); toggleLike(item.id); }}
                        className={cn(
                          "flex items-center gap-1 text-[10px] font-black transition-all",
                          item.hasLiked ? "text-[#ff6b9d]" : "text-gray-400 hover:text-[#ff6b9d]"
                        )}
                      >
                        <Heart size={12} fill={item.hasLiked ? "currentColor" : "none"} />
                        {item.likesCount || 0}
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setSelectedDrawing(item); fetchComments(item.id); }}
                        className="flex items-center gap-1 text-[10px] font-black text-gray-400 hover:text-[#7c6cf8] transition-all"
                      >
                        <MessageCircle size={12} />
                        Chat
                      </button>
                    </div>
                  </div>
                ))}
                {communityItems.length === 0 && (
                  <div className="col-span-full py-4 text-center text-gray-400 text-xs font-bold">
                    No community drawings yet. Be the first to teach me! 🎨
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'photo-edit' && (
            <div className="space-y-4 p-4 bg-white rounded-3xl border-2 border-[#e8e6ff] shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-black text-[#7c6cf8] flex items-center gap-2">
                  <Palette size={18} /> Photo Editor & AI Refine
                </h3>
                <button 
                  onClick={resetFilters}
                  className="text-[10px] font-bold text-gray-400 hover:text-[#7c6cf8] transition-all"
                >
                  Reset All
                </button>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase">Brightness</label>
                  <input type="range" min="0" max="200" value={brightness} onChange={(e) => setBrightness(parseInt(e.target.value))} className="w-full accent-[#7c6cf8]" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase">Contrast</label>
                  <input type="range" min="0" max="200" value={contrast} onChange={(e) => setContrast(parseInt(e.target.value))} className="w-full accent-[#7c6cf8]" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase">Saturation</label>
                  <input type="range" min="0" max="200" value={saturate} onChange={(e) => setSaturate(parseInt(e.target.value))} className="w-full accent-[#7c6cf8]" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase">Blur</label>
                  <input type="range" min="0" max="20" value={blur} onChange={(e) => setBlur(parseInt(e.target.value))} className="w-full accent-[#7c6cf8]" />
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                <button onClick={() => { setGrayscale(grayscale === 100 ? 0 : 100); playSound('click'); }} className={cn("px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all", grayscale === 100 ? "bg-[#7c6cf8] text-white" : "bg-gray-100 text-gray-600")}>Grayscale</button>
                <button onClick={() => { setSepia(sepia === 100 ? 0 : 100); playSound('click'); }} className={cn("px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all", sepia === 100 ? "bg-[#7c6cf8] text-white" : "bg-gray-100 text-gray-600")}>Sepia</button>
                <button onClick={() => { setInvert(invert === 100 ? 0 : 100); playSound('click'); }} className={cn("px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all", invert === 100 ? "bg-[#7c6cf8] text-white" : "bg-gray-100 text-gray-600")}>Invert</button>
                <button onClick={applyFilters} className="px-4 py-1.5 rounded-xl bg-[#ff6b9d] text-white text-[10px] font-black shadow-lg hover:scale-105 transition-all ml-auto">Apply Filters ✨</button>
              </div>

              <div className="pt-4 border-t border-gray-100">
                <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block">AI Refine (Advanced)</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Describe how to refine your drawing (e.g., 'make it a realistic oil painting')"
                    className="flex-1 p-2.5 rounded-2xl border-2 border-gray-200 text-sm font-bold focus:border-[#7c6cf8] outline-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') refineWithAI(e.currentTarget.value);
                    }}
                  />
                  <button 
                    onClick={(e) => {
                      const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                      refineWithAI(input.value);
                    }}
                    className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-[#7c6cf8] to-[#ff6b9d] text-white font-extrabold hover:scale-105 transition-all shadow-md"
                  >
                    Refine 🪄
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ai-gen' && (
            <div className="space-y-3">
              <div className="p-4 bg-gradient-to-br from-[#16213e] to-[#0f3460] rounded-2xl border border-[#7c6cf8]/30 shadow-xl">
                <h3 className="font-fredoka text-lg text-[#7c6cf8] mb-2 flex items-center gap-2">
                  <Wand2 size={20} /> AI Imagination Engine 🎨✨
                </h3>
                <p className="text-xs font-bold text-gray-400 mb-4">
                  Describe anything, and our AI will generate a high-quality image directly onto your canvas.
                </p>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder='e.g. "A futuristic city with flying cars and neon lights"'
                    className="flex-1 p-3 rounded-2xl bg-[#1a1a2e] border-2 border-[#0f3460] text-white text-sm font-bold focus:border-[#7c6cf8] outline-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') generateImage(e.currentTarget.value);
                    }}
                  />
                  <button 
                    onClick={(e) => {
                      const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                      generateImage(input.value);
                    }}
                    className="px-6 py-3 rounded-2xl bg-gradient-to-r from-[#7c6cf8] to-[#ff6b9d] text-white font-extrabold hover:scale-105 transition-all shadow-lg shadow-[#7c6cf8]/20"
                  >
                    Imagine 🪄
                  </button>
                </div>
                <div className="mt-4 flex gap-2 flex-wrap">
                  <span className="text-[10px] text-gray-500 font-bold self-center">Quick Ideas:</span>
                  {['Cyberpunk Forest', 'Underwater Palace', 'Space Station', 'Dragon Mountain'].map(idea => (
                    <button 
                      key={idea}
                      onClick={() => generateImage(idea)}
                      className="px-2 py-1 rounded-lg bg-[#0f3460] text-[#7c6cf8] text-[10px] font-bold hover:bg-[#7c6cf8] hover:text-white transition-all"
                    >
                      {idea}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'upload' && (
            <div className="space-y-3">
              <div className="border-2 border-dashed border-[#c0b8f8] rounded-2xl p-4 text-center bg-[#faf8ff] hover:bg-[#f0edff] transition-all cursor-pointer relative">
                <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      const img = new Image();
                      img.onload = () => {
                        saveUndo();
                        const ctx = ctxRef.current!;
                        const canvas = canvasRef.current!;
                        const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
                        ctx.drawImage(img, (canvas.width - img.width * scale) / 2, (canvas.height - img.height * scale) / 2, img.width * scale, img.height * scale);
                      };
                      img.src = ev.target?.result as string;
                    };
                    reader.readAsDataURL(file);
                  }
                }} />
                <div className="text-3xl mb-1">🖼️</div>
                <div className="text-xs font-extrabold text-[#7c6cf8]">Drop an image here or click to upload!</div>
                <div className="text-[10px] text-gray-400 mt-1">PNG, JPG, GIF supported</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="bg-white border-t border-[#e0e0ff] px-3 py-1 flex items-center gap-4 text-[10px] text-gray-400 font-bold">
        <span className="flex items-center gap-1 text-[#7c6cf8]"><Brush size={10} /> {currentTool.toUpperCase()}</span>
        <span>Drawings: {drawCount}</span>
        <span className="ml-auto">ScribbleDash by Nova Studios ✨ v8.0</span>
      </div>

      <AnimatePresence>
        {selectedDrawing && (
          <CommentsModal 
            drawing={selectedDrawing}
            comments={comments}
            onClose={() => setSelectedDrawing(null)}
            onAddComment={(text) => addComment(selectedDrawing.id, text)}
          />
        )}
      </AnimatePresence>
    </div>
    </ErrorBoundary>
  );
}

function ToolButton({ icon: Icon, active, onClick, title, mode = 'kids' }: { icon: any, active?: boolean, onClick: () => void, title: string, mode?: AppMode }) {
  return (
    <button 
      onClick={onClick}
      title={title}
      className={cn(
        "w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-110 shadow-sm",
        mode === 'kids' 
          ? (active ? "bg-[#f0edff] text-[#7c6cf8] ring-2 ring-[#7c6cf8]" : "bg-white text-gray-600 hover:bg-[#f0edff]")
          : (active ? "bg-[#7c6cf8] text-white ring-2 ring-[#00d2ff]" : "bg-[#1a1a2e] text-gray-400 hover:bg-[#16213e] hover:text-white")
      )}
    >
      <Icon size={20} />
    </button>
  );
}

function TutorialCard({ title, desc, steps }: { title: string, desc: string, steps: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-gradient-to-br from-[#f8f0ff] to-[#fff8f0] rounded-2xl border border-[#e8d8ff] p-3 cursor-pointer hover:translate-y-[-2px] transition-all shadow-sm" onClick={() => setOpen(!open)}>
      <div className="text-sm font-black text-[#7c6cf8] mb-1">{title}</div>
      <div className="text-[11px] text-gray-600 font-bold leading-tight">{desc}</div>
      {open && (
        <div className="mt-2 pt-2 border-t border-[#e8d8ff] space-y-1.5">
          {steps.map((s, i) => (
            <div key={i} className="flex gap-2 items-start text-[11px] font-bold text-gray-700">
              <div className="min-w-[18px] h-[18px] rounded-full bg-[#7c6cf8] text-white text-[10px] flex items-center justify-center flex-shrink-0">{i + 1}</div>
              <div>{s}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
function TabButton({ active, onClick, icon: Icon, label, mode = 'kids' }: { active: boolean, onClick: () => void, icon: any, label: string, mode?: AppMode }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-4 py-2 rounded-full border-2 transition-all text-xs font-extrabold whitespace-nowrap",
        mode === 'kids'
          ? (active ? "bg-[#7c6cf8] text-white border-[#7c6cf8] shadow-md" : "bg-white text-gray-400 border-[#e0e0ff] hover:bg-[#f0edff] hover:text-[#7c6cf8]")
          : (active ? "bg-gradient-to-r from-[#7c6cf8] to-[#ff6b9d] text-white border-transparent shadow-lg shadow-[#7c6cf8]/20" : "bg-[#1a1a2e] text-gray-500 border-[#0f3460] hover:border-[#7c6cf8] hover:text-white")
      )}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

function CommentsModal({ drawing, comments, onClose, onAddComment }: { drawing: CommunityDrawing, comments: Comment[], onClose: () => void, onAddComment: (text: string) => void }) {
  const [text, setText] = useState('');
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
      >
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-[#7c6cf8] to-[#ff6b9d] text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden border-2 border-white shadow-sm">
              <img src={drawing.imageData} alt={drawing.name} className="w-full h-full object-cover" />
            </div>
            <div>
              <h3 className="text-sm font-black truncate">{drawing.name}</h3>
              <p className="text-[10px] font-bold opacity-80">by {drawing.userName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-all"><XCircle size={24} /></button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
          {comments.length === 0 && (
            <div className="text-center py-10 text-gray-400 text-xs font-bold">
              No comments yet. Be the first to say something! 💬
            </div>
          )}
          {comments.map(c => (
            <div key={c.id} className="flex gap-3">
              <img src={c.userPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.userId}`} alt={c.userName} className="w-8 h-8 rounded-full border border-gray-200" />
              <div className="flex-1">
                <div className="bg-white p-3 rounded-2xl rounded-tl-none border border-gray-100 shadow-sm">
                  <div className="text-[10px] font-black text-[#7c6cf8] mb-1">{c.userName}</div>
                  <div className="text-xs font-bold text-gray-700 leading-relaxed">{c.text}</div>
                </div>
                <div className="text-[8px] text-gray-400 font-bold mt-1 ml-1">{new Date(c.createdAt).toLocaleString()}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 bg-white border-t border-gray-100 flex gap-2">
          <input 
            type="text" 
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a comment..."
            className="flex-1 p-3 rounded-2xl border-2 border-gray-100 text-sm font-bold focus:border-[#7c6cf8] outline-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onAddComment(text);
                setText('');
              }
            }}
          />
          <button 
            onClick={() => {
              onAddComment(text);
              setText('');
            }}
            className="px-6 py-3 rounded-2xl bg-[#7c6cf8] text-white font-black text-sm hover:bg-[#534AB7] transition-all shadow-md"
          >
            Send
          </button>
        </div>
      </motion.div>
    </div>
  );
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Something went wrong.";
      try {
        const errInfo = JSON.parse(this.state.error.message);
        errorMessage = `Firestore Error: ${errInfo.error} during ${errInfo.operationType} on ${errInfo.path}`;
      } catch (e) {
        errorMessage = this.state.error.message || String(this.state.error);
      }

      return (
        <div className="min-h-screen bg-[#f8f8ff] flex items-center justify-center p-6 text-center">
          <div className="bg-white p-8 rounded-3xl border-4 border-[#ff6b9d] shadow-2xl max-w-md">
            <div className="text-6xl mb-4">😵</div>
            <h1 className="text-2xl font-black text-[#ff6b9d] mb-2">Oops! ScribbleDash crashed!</h1>
            <p className="text-sm font-bold text-gray-600 mb-6">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-8 py-3 rounded-2xl bg-[#7c6cf8] text-white font-black hover:scale-105 transition-all shadow-lg"
            >
              Restart ScribbleDash ✨
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
