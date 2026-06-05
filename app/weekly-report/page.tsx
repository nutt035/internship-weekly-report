'use client';

import {
  useRef,
  useState,
  useEffect,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from 'react';
import SignatureCanvas from 'react-signature-canvas';
import type { ApiResponse } from '../types';

/* key เดียวสำหรับบันทึกแบบร่างทั้งหมดลง localStorage */
const DRAFT_KEY = 'weeklyReportDraft';

/* ========================================================================== */
/*  Image compression helpers                                                 */
/* ========================================================================== */

/**
 * Draws a source image/canvas onto a new canvas capped at maxW×maxH,
 * then returns a compressed JPEG data-URL at the requested quality.
 */
function compressToDataUrl(
  source: HTMLCanvasElement | HTMLImageElement,
  maxW: number,
  maxH: number,
  quality = 0.8,
): string {
  const srcW = source instanceof HTMLCanvasElement ? source.width : (source as HTMLImageElement).naturalWidth;
  const srcH = source instanceof HTMLCanvasElement ? source.height : (source as HTMLImageElement).naturalHeight;
  const ratio = Math.min(1, maxW / srcW, maxH / srcH);
  const w = Math.round(srcW * ratio);
  const h = Math.round(srcH * ratio);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(source, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Reads a File, converts from HEIC to JPEG if needed, draws it into a canvas,
 * and returns a compressed Blob (JPEG, max 1200×1200, 70% quality)
 */
async function compressImageFile(file: File, maxW = 1200, maxH = 1200, quality = 0.7): Promise<File> {
  let targetFile = file;

  // แอบแปลง HEIC เป็น JPEG ก่อนเข้ากระบวนการวาด Canvas
  if (file.name.toLowerCase().endsWith('.heic') || file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heif')) {
    try {
      const heic2any = (await import('heic2any')).default;
      const convertedBlob = await heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: quality,
      });
      const finalBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
      targetFile = new File([finalBlob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
    } catch (err) {
      console.warn('HEIC conversion failed:', err);
    }
  }

  return new Promise((resolve) => {
    const url = URL.createObjectURL(targetFile);
    const img = new Image();
    img.onload = () => {
      const dataUrl = compressToDataUrl(img, maxW, maxH, quality);
      URL.revokeObjectURL(url);
      const [, b64] = dataUrl.split(',');
      const bytes = atob(b64);
      const arr = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
      const blob = new Blob([arr], { type: 'image/jpeg' });
      const name = targetFile.name.replace(/\.[^.]+$/, '') + '.jpg';
      resolve(new File([blob], name, { type: 'image/jpeg' }));
    };
    img.onerror = () => {
      // แจ้งเตือนผู้ใช้แทนที่จะส่งไฟล์ต้นฉบับขนาดใหญ่ไปเงียบๆ
      // (เกิดเมื่อ browser อ่านไฟล์ไม่ได้ เช่น .HEIC บน Chrome)
      alert(
        `ไม่สามารถย่อขนาดรูป "${targetFile.name}" ได้\n` +
        `Browser ไม่รองรับรูปฟอร์แมตนี้ กรุณาเลือกรูปใหม่เป็น JPEG หรือ PNG ครับ`,
      );
      resolve(targetFile); // fallback: ส่งไฟล์ต้นฉบับ (อาจทำให้ upload ล้มเหลวถ้าไฟล์ใหญ่)
    };
    img.src = url;
  });
}

/* ========================================================================== */
/*  Sub-components                                                            */
/* ========================================================================== */

function SectionCard({
  num,
  title,
  delay = 0,
  children,
}: {
  num: string;
  title: string;
  delay?: number;
  children: ReactNode;
}) {
  return (
    <section className="card animate-in" style={{ animationDelay: `${delay}ms` }}>
      <div className="mb-5">
        <span className="section-number">ส่วนที่ {num}</span>
        <h2 className="section-title">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  error,
  htmlFor,
  children,
}: {
  label: string;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="form-label">
        {label}
      </label>
      {children}
      {error && (
        <p className="mt-1.5 text-xs" style={{ color: 'var(--error)' }}>
          {error}
        </p>
      )}
    </div>
  );
}

/* ========================================================================== */
/*  Main Form                                                                 */
/* ========================================================================== */

export default function WeeklyReportForm() {
  /* ----- §01 ข้อมูลทั่วไป ----- */
  const [studentName, setStudentName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [classRoom, setClassRoom] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [weekNumber, setWeekNumber] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  /* ----- §02 งานรายวัน (จันทร์–เสาร์) ----- */
  const [taskMonday, setTaskMonday] = useState('');
  const [taskTuesday, setTaskTuesday] = useState('');
  const [taskWednesday, setTaskWednesday] = useState('');
  const [taskThursday, setTaskThursday] = useState('');
  const [taskFriday, setTaskFriday] = useState('');
  const [taskSaturday, setTaskSaturday] = useState('');

  /* ----- §03 สรุปผล ----- */
  const [completedWork, setCompletedWork] = useState('');
  const [learnings, setLearnings] = useState('');
  const [problems, setProblems] = useState('');
  const [solutions, setSolutions] = useState('');
  const [weeklySummary, setWeeklySummary] = useState('');

  /* ----- §04 รูปภาพ (3 ช่อง + คำอธิบาย) ----- */
  const [image1, setImage1] = useState<File | null>(null);
  const [image2, setImage2] = useState<File | null>(null);
  const [image3, setImage3] = useState<File | null>(null);
  const [preview1, setPreview1] = useState('');
  const [preview2, setPreview2] = useState('');
  const [preview3, setPreview3] = useState('');
  const [imgDesc1, setImgDesc1] = useState('');
  const [imgDesc2, setImgDesc2] = useState('');
  const [imgDesc3, setImgDesc3] = useState('');

  /* ----- §05 การรับรอง ----- */
  const [supervisorComments, setSupervisorComments] = useState('');
  const [supervisorName, setSupervisorName] = useState('');
  const [supervisorPosition, setSupervisorPosition] = useState('');
  const [signedDate, setSignedDate] = useState('');

  /* ----- ลายเซ็น (วาด / พิมพ์) ----- */
  const [sigMode, setSigMode] = useState<'draw' | 'text'>('draw');
  const [sigText, setSigText] = useState('');
  const sigRef = useRef<SignatureCanvas>(null);

  /* ----- ตั้งค่าส่วนตัว (จำข้ามสัปดาห์) ----- */
  const [internshipStartDate, setInternshipStartDate] = useState('');

  /* ----- UI state ----- */
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveIndicator, setSaveIndicator] = useState(false);

  /* ======================== Load/Save Local Storage ======================== */

  // โหลดข้อมูลที่บันทึกไว้ทั้งหมดเมื่อเปิดหน้าครั้งแรก
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (!saved) return;
      const d = JSON.parse(saved) as Record<string, string>;
      if (d.studentName)         setStudentName(d.studentName);
      if (d.studentId)           setStudentId(d.studentId);
      if (d.classRoom)           setClassRoom(d.classRoom);
      if (d.companyName)         setCompanyName(d.companyName);
      if (d.internshipStartDate) setInternshipStartDate(d.internshipStartDate);
      if (d.weekNumber)          setWeekNumber(d.weekNumber);
      if (d.startDate)           setStartDate(d.startDate);
      if (d.endDate)             setEndDate(d.endDate);
      if (d.taskMonday)          setTaskMonday(d.taskMonday);
      if (d.taskTuesday)         setTaskTuesday(d.taskTuesday);
      if (d.taskWednesday)       setTaskWednesday(d.taskWednesday);
      if (d.taskThursday)        setTaskThursday(d.taskThursday);
      if (d.taskFriday)          setTaskFriday(d.taskFriday);
      if (d.taskSaturday)        setTaskSaturday(d.taskSaturday);
      if (d.completedWork)       setCompletedWork(d.completedWork);
      if (d.learnings)           setLearnings(d.learnings);
      if (d.problems)            setProblems(d.problems);
      if (d.solutions)           setSolutions(d.solutions);
      if (d.weeklySummary)       setWeeklySummary(d.weeklySummary);
      if (d.supervisorComments)  setSupervisorComments(d.supervisorComments);
      if (d.supervisorName)      setSupervisorName(d.supervisorName);
      if (d.supervisorPosition)  setSupervisorPosition(d.supervisorPosition);
      if (d.signedDate)          setSignedDate(d.signedDate);
      if (d.imgDesc1)            setImgDesc1(d.imgDesc1);
      if (d.imgDesc2)            setImgDesc2(d.imgDesc2);
      if (d.imgDesc3)            setImgDesc3(d.imgDesc3);
    } catch { /* parse ไม่ได้ก็ข้ามไป */ }
  }, []);

  // บันทึกอัตโนมัติทุกครั้งที่มีการเปลี่ยนแปลง (debounce 800 ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({
          studentName, studentId, classRoom, companyName,
          internshipStartDate,
          weekNumber, startDate, endDate,
          taskMonday, taskTuesday, taskWednesday, taskThursday, taskFriday, taskSaturday,
          completedWork, learnings, problems, solutions, weeklySummary,
          supervisorComments, supervisorName, supervisorPosition, signedDate,
          imgDesc1, imgDesc2, imgDesc3,
        }));
        setSaveIndicator(true);
        setTimeout(() => setSaveIndicator(false), 1500);
      } catch { /* storage เต็ม? ข้ามไป */ }
    }, 800);
    return () => clearTimeout(timer);
  }, [
    studentName, studentId, classRoom, companyName, internshipStartDate,
    weekNumber, startDate, endDate,
    taskMonday, taskTuesday, taskWednesday, taskThursday, taskFriday, taskSaturday,
    completedWork, learnings, problems, solutions, weeklySummary,
    supervisorComments, supervisorName, supervisorPosition, signedDate,
    imgDesc1, imgDesc2, imgDesc3,
  ]);

  /* ======================== Image handlers ======================== */

  const handleImageFile =
    (
      setFile: (f: File | null) => void,
      setPreview: (s: string) => void,
    ) =>
    (e: ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0] ?? null;
      if (!f) return;
      setFile(f);
      setPreview(URL.createObjectURL(f));
    };

  const removeImageSlot = (
    preview: string,
    setFile: (f: File | null) => void,
    setPreview: (s: string) => void,
  ) => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview('');
  };

  const IMAGE_SLOTS = [
    { num: 1, file: image1, preview: preview1, desc: imgDesc1, setFile: setImage1, setPreview: setPreview1, setDesc: setImgDesc1 },
    { num: 2, file: image2, preview: preview2, desc: imgDesc2, setFile: setImage2, setPreview: setPreview2, setDesc: setImgDesc2 },
    { num: 3, file: image3, preview: preview3, desc: imgDesc3, setFile: setImage3, setPreview: setPreview3, setDesc: setImgDesc3 },
  ];

  /* ======================== Validate ======================== */

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!studentName.trim()) e.studentName = 'กรุณากรอกชื่อนักศึกษา';
    if (!studentId.trim()) e.studentId = 'กรุณากรอกรหัสนักศึกษา';
    if (!classRoom.trim()) e.classRoom = 'กรุณากรอกระดับชั้น/ห้อง';
    if (!weekNumber.trim()) e.weekNumber = 'กรุณากรอกสัปดาห์ที่';
    if (!startDate) e.startDate = 'กรุณาเลือกวันที่เริ่มต้น';
    if (!endDate) e.endDate = 'กรุณาเลือกวันที่สิ้นสุด';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  /* ======================== กรอกสัปดาห์นี้อัตโนมัติ ======================== */

  const fillThisWeek = () => {
    const today = new Date();
    const dow = today.getDay(); // 0 = อาทิตย์
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
    const saturday = new Date(monday);
    saturday.setDate(monday.getDate() + 5);

    const fmt = (d: Date) => d.toISOString().split('T')[0];
    setStartDate(fmt(monday));
    setEndDate(fmt(saturday));

    if (internshipStartDate) {
      // snap วันเริ่มฝึกงานไปวันจันทร์ของสัปดาห์นั้น
      const start = new Date(internshipStartDate);
      const startDow = start.getDay();
      const startMonday = new Date(start);
      startMonday.setDate(start.getDate() - (startDow === 0 ? 6 : startDow - 1));
      const diffDays = Math.floor(
        (monday.getTime() - startMonday.getTime()) / (1000 * 60 * 60 * 24),
      );
      const week = Math.floor(diffDays / 7) + 1;
      if (week >= 1) setWeekNumber(String(week));
    }
  };

  /* ======================== Submit ========================== */

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setResult(null);

    try {
      const fd = new FormData();

      /* text fields */
      fd.append('studentName', studentName);
      fd.append('studentId', studentId);
      fd.append('classRoom', classRoom);
      fd.append('companyName', companyName);
      fd.append('weekNumber', weekNumber);
      fd.append('startDate', startDate);
      fd.append('endDate', endDate);
      fd.append('taskMonday', taskMonday);
      fd.append('taskTuesday', taskTuesday);
      fd.append('taskWednesday', taskWednesday);
      fd.append('taskThursday', taskThursday);
      fd.append('taskFriday', taskFriday);
      fd.append('taskSaturday', taskSaturday);
      fd.append('completedWork', completedWork);
      fd.append('learnings', learnings);
      fd.append('problems', problems);
      fd.append('solutions', solutions);
      fd.append('weeklySummary', weeklySummary);
      fd.append('supervisorComments', supervisorComments);
      fd.append('supervisorName', supervisorName);
      fd.append('supervisorPosition', supervisorPosition);
      fd.append('signedDate', signedDate);

      fd.append('imageDesc1', imgDesc1);
      fd.append('imageDesc2', imgDesc2);
      fd.append('imageDesc3', imgDesc3);

      /* images — compress before upload to stay well under Vercel's body limit */
      if (image1) fd.append('image_1', await compressImageFile(image1));
      if (image2) fd.append('image_2', await compressImageFile(image2));
      if (image3) fd.append('image_3', await compressImageFile(image3));

      /* signature */
      fd.append('signatureMode', sigMode);
      if (sigMode === 'draw') {
        let data = '';
        if (sigRef.current && !sigRef.current.isEmpty()) {
          const trimmedCanvas = sigRef.current.getTrimmedCanvas();
          // สร้าง canvas สำรองเพื่อเปลี่ยนสีเส้นลายเซ็นเป็นสีดำสำหรับการนำไปวางบนกระดาษขาวใน Google Docs
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = trimmedCanvas.width;
          tempCanvas.height = trimmedCanvas.height;
          const tempCtx = tempCanvas.getContext('2d');
          if (tempCtx) {
            tempCtx.drawImage(trimmedCanvas, 0, 0);
            tempCtx.globalCompositeOperation = 'source-in';
            tempCtx.fillStyle = '#000000'; // สีดำ
            tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
          }
          // Compress the signature: downscale to max 600×200, JPEG 80%
          // This shrinks a typical PNG signature from ~800 KB → ~30 KB
          data = compressToDataUrl(tempCanvas, 600, 200, 0.8);
        }
        fd.append('signatureImage', data);
      } else {
        fd.append('signatureText', sigText);
      }

      const res = await fetch('/api/weekly-report', { method: 'POST', body: fd });
      const json: ApiResponse = await res.json();
      setResult(json);
    } catch {
      setResult({
        success: false,
        error: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ======================== Reset ========================== */

  const resetForm = () => {
    // Keep personal info, reset the rest
    setWeekNumber(''); setStartDate(''); setEndDate('');
    setTaskMonday(''); setTaskTuesday(''); setTaskWednesday('');
    setTaskThursday(''); setTaskFriday(''); setTaskSaturday('');
    setCompletedWork(''); setLearnings(''); setProblems('');
    setSolutions(''); setWeeklySummary('');
    setSupervisorComments(''); setSupervisorName('');
    setSupervisorPosition(''); setSignedDate('');
    [preview1, preview2, preview3].forEach((p) => p && URL.revokeObjectURL(p));
    setImage1(null); setImage2(null); setImage3(null);
    setPreview1(''); setPreview2(''); setPreview3('');
    setImgDesc1(''); setImgDesc2(''); setImgDesc3('');
    sigRef.current?.clear();
    setSigMode('draw'); setSigText('');
    setResult(null); setErrors({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* ======================== Day configs ======================== */

  const DAYS = [
    { label: 'วันจันทร์', value: taskMonday, set: setTaskMonday },
    { label: 'วันอังคาร', value: taskTuesday, set: setTaskTuesday },
    { label: 'วันพุธ', value: taskWednesday, set: setTaskWednesday },
    { label: 'วันพฤหัสบดี', value: taskThursday, set: setTaskThursday },
    { label: 'วันศุกร์', value: taskFriday, set: setTaskFriday },
    { label: 'วันเสาร์ (ถ้ามี)', value: taskSaturday, set: setTaskSaturday },
  ];

  /* ======================== Render ========================== */

  return (
    <div className="relative z-10 mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:py-14">
      {/* ==================== Header ==================== */}
      <header className="animate-in mb-10 text-center" style={{ animationDelay: '0ms' }}>
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--accent)' }}>
          แผนกวิชาเมคคาทรอนิกส์และหุ่นยนต์
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          แบบรายงานสรุปผลการฝึกงานประจำสัปดาห์
        </h1>
        <p className="mt-3 text-sm" style={{ color: 'var(--text-muted)' }}>
          นักศึกษาฝึกงานทวิภาคี — กรอกข้อมูลแล้วกด
          &quot;ส่งรายงาน&quot; เพื่อสร้าง Google Docs อัตโนมัติ
        </p>
        {/* ตัวบอกสถานะ auto-save */}
        <p
          className="mt-1.5 text-xs transition-opacity duration-700"
          style={{ color: 'var(--success, #4ade80)', opacity: saveIndicator ? 1 : 0 }}
        >
          💾 บันทึกอัตโนมัติแล้ว
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* =============== §01 ข้อมูลทั่วไป =============== */}
        <SectionCard num="01" title="ข้อมูลทั่วไป" delay={60}>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="ชื่อ-นามสกุล นักศึกษา" htmlFor="studentName" error={errors.studentName}>
              <input id="studentName" type="text" className={`form-input ${errors.studentName ? 'has-error' : ''}`}
                placeholder="เช่น สมชาย ใจดี" value={studentName} onChange={(e) => setStudentName(e.target.value)} />
            </Field>
            <Field label="รหัสนักศึกษา" htmlFor="studentId" error={errors.studentId}>
              <input id="studentId" type="text" className={`form-input ${errors.studentId ? 'has-error' : ''}`}
                placeholder="เช่น 66201" value={studentId} onChange={(e) => setStudentId(e.target.value)} />
            </Field>
            <Field label="ระดับชั้น / ห้อง" htmlFor="classRoom" error={errors.classRoom}>
              <input id="classRoom" type="text" className={`form-input ${errors.classRoom ? 'has-error' : ''}`}
                placeholder="เช่น DVE 2/41" value={classRoom} onChange={(e) => setClassRoom(e.target.value)} />
            </Field>
            <Field label="สถานประกอบการ" htmlFor="companyName">
              <input id="companyName" type="text" className="form-input"
                placeholder="ชื่อบริษัท / หน่วยงาน" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
            </Field>

            {/* ── ตั้งค่าครั้งเดียว → กรอกสัปดาห์อัตโนมัติ ── */}
            <div className="sm:col-span-2">
              <div className="task-card">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
                  ⚡ ตั้งค่าครั้งเดียว — ระบบจะคำนวณสัปดาห์ให้อัตโนมัติ
                </p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <label htmlFor="internshipStartDate" className="form-label">
                      วันแรกที่เริ่มฝึกงาน
                    </label>
                    <input
                      id="internshipStartDate"
                      type="date"
                      className="form-input"
                      value={internshipStartDate}
                      onChange={(e) => setInternshipStartDate(e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={fillThisWeek}
                    className="btn-accent-sm shrink-0"
                    style={{ padding: '10px 20px', fontSize: '0.875rem', fontWeight: 700 }}
                  >
                    🗓️ กรอกสัปดาห์นี้
                  </button>
                </div>
                <p className="mt-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                  {internshipStartDate
                    ? '✅ กดปุ่มด้านบนทุกสัปดาห์ — วันที่ + สัปดาห์ที่จะถูกกรอกให้อัตโนมัติ'
                    : '💡 กรอกวันแรกที่เริ่มฝึกงาน แล้วกดปุ่ม — ระบบจะคำนวณวันที่และสัปดาห์ที่ให้เองทุกครั้ง'}
                </p>
              </div>
            </div>

            <Field label="สัปดาห์ที่" htmlFor="weekNumber" error={errors.weekNumber}>
              <input id="weekNumber" type="number" min={1} className={`form-input ${errors.weekNumber ? 'has-error' : ''}`}
                placeholder="เช่น 4" value={weekNumber} onChange={(e) => setWeekNumber(e.target.value)} />
            </Field>
            <Field label="วันที่เริ่มต้น" htmlFor="startDate" error={errors.startDate}>
              <input id="startDate" type="date" className={`form-input ${errors.startDate ? 'has-error' : ''}`}
                value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
            <Field label="วันที่สิ้นสุด" htmlFor="endDate" error={errors.endDate}>
              <input id="endDate" type="date" className={`form-input ${errors.endDate ? 'has-error' : ''}`}
                value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </Field>
          </div>
        </SectionCard>

        {/* =============== §02 งานรายวัน =============== */}
        <SectionCard num="02" title="สรุปงานที่ได้รับมอบหมายในแต่ละวัน" delay={120}>
          <div className="space-y-3">
            {DAYS.map(({ label, value, set }) => (
              <div key={label} className="task-card">
                <span className="text-sm font-medium" style={{ color: 'var(--accent)' }}>
                  {label}
                </span>
                <textarea
                  rows={2}
                  className="form-input form-textarea mt-3"
                  placeholder={`รายละเอียดงาน${label}...`}
                  value={value}
                  onChange={(e) => set(e.target.value)}
                />
              </div>
            ))}
          </div>
        </SectionCard>

        {/* =============== §03 สรุปผล =============== */}
        <SectionCard num="03" title="สรุปผลการดำเนินงาน" delay={180}>
          <div className="space-y-5">
            <Field label="งานที่ดำเนินการสำเร็จในสัปดาห์นี้" htmlFor="completedWork">
              <textarea id="completedWork" rows={3} className="form-input form-textarea"
                placeholder="สรุปงานที่ทำเสร็จ..." value={completedWork} onChange={(e) => setCompletedWork(e.target.value)} />
            </Field>
            <Field label="สิ่งที่ได้เรียนรู้และทักษะที่ได้รับ" htmlFor="learnings">
              <textarea id="learnings" rows={3} className="form-input form-textarea"
                placeholder="ทักษะหรือความรู้ใหม่..." value={learnings} onChange={(e) => setLearnings(e.target.value)} />
            </Field>
            <Field label="ปัญหาและอุปสรรคที่พบ" htmlFor="problems">
              <textarea id="problems" rows={3} className="form-input form-textarea"
                placeholder="ปัญหาที่เจอ..." value={problems} onChange={(e) => setProblems(e.target.value)} />
            </Field>
            <Field label="แนวทางการแก้ไข / วิธีการปรับปรุงแก้ไข" htmlFor="solutions">
              <textarea id="solutions" rows={3} className="form-input form-textarea"
                placeholder="แก้ไขอย่างไร..." value={solutions} onChange={(e) => setSolutions(e.target.value)} />
            </Field>
            <Field label="สรุปผลการฝึกงานประจำสัปดาห์ (ภาพรวม)" htmlFor="weeklySummary">
              <textarea id="weeklySummary" rows={3} className="form-input form-textarea"
                placeholder="ภาพรวมของสัปดาห์นี้..." value={weeklySummary} onChange={(e) => setWeeklySummary(e.target.value)} />
            </Field>
          </div>
        </SectionCard>

        {/* =============== §04 ภาพประกอบ =============== */}
        <SectionCard num="04" title="ภาพประกอบการปฏิบัติงาน" delay={240}>
          <div className="space-y-4">
            {IMAGE_SLOTS.map(({ num, preview, desc, setFile, setPreview, setDesc }) => (
              <div key={num} className="task-card">
                <span className="section-number">รูปที่ {String(num).padStart(2, '0')}</span>

                {preview ? (
                  <div className="relative mt-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={preview} alt={`รูปที่ ${num}`} className="preview-thumb h-48 w-full object-cover" />
                    <button type="button"
                      onClick={() => removeImageSlot(preview, setFile, setPreview)}
                      className="absolute right-2 top-2 btn-danger-sm">
                      ลบ
                    </button>
                  </div>
                ) : (
                  <label className="upload-zone mt-3 block cursor-pointer">
                    {/* รับรูปทุกประเภท เพื่อให้ JS หลังบ้านดักจับและแปลง HEIC ให้อัตโนมัติ (เพื่อนไม่ต้องตกใจ) */}
                <input
                  type="file"
                  accept="image/*, .heic, .heif"
                  onChange={handleImageFile(setFile, setPreview)}
                  className="hidden"
                />
                    <span className="block text-sm" style={{ color: 'var(--text-secondary)' }}>
                      คลิกเพื่อเลือกรูป
                    </span>
                  </label>
                )}

                <div className="mt-3">
                  <Field label="คำอธิบายภาพ">
                    <input type="text" className="form-input" placeholder="อธิบายสั้นๆ ว่ารูปนี้คืออะไร..."
                      value={desc} onChange={(e) => setDesc(e.target.value)} />
                  </Field>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* =============== §05 การรับรอง =============== */}
        <SectionCard num="05" title="การรับรองผลจากสถานประกอบการ" delay={300}>
          <div className="space-y-5">
            <Field label="ความคิดเห็นหรือข้อเสนอแนะจากพี่เลี้ยง / หัวหน้างาน" htmlFor="supervisorComments">
              <textarea id="supervisorComments" rows={3} className="form-input form-textarea"
                placeholder="ข้อเสนอแนะ (ถ้ามี)..." value={supervisorComments} onChange={(e) => setSupervisorComments(e.target.value)} />
            </Field>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label="ชื่อผู้รับรอง" htmlFor="supervisorName">
                <input id="supervisorName" type="text" className="form-input"
                  placeholder="เช่น คุณสมศรี" value={supervisorName} onChange={(e) => setSupervisorName(e.target.value)} />
              </Field>
              <Field label="ตำแหน่ง" htmlFor="supervisorPosition">
                <input id="supervisorPosition" type="text" className="form-input"
                  placeholder="เช่น หัวหน้าแผนก" value={supervisorPosition} onChange={(e) => setSupervisorPosition(e.target.value)} />
              </Field>
            </div>

            <Field label="วันที่ลงนาม" htmlFor="signedDate">
              <input id="signedDate" type="date" className="form-input"
                value={signedDate} onChange={(e) => setSignedDate(e.target.value)} />
            </Field>

            {/* ---------- Signature ---------- */}
            <div>
              <div className="mb-3 flex items-end justify-between">
                <span className="form-label mb-0">ลายเซ็นผู้รับรอง</span>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setSigMode('draw')}
                    className={sigMode === 'draw' ? 'btn-accent-sm' : 'btn-secondary'}>
                    วาดลายเซ็น
                  </button>
                  <button type="button" onClick={() => setSigMode('text')}
                    className={sigMode === 'text' ? 'btn-accent-sm' : 'btn-secondary'}>
                    พิมพ์ข้อความ
                  </button>
                </div>
              </div>

              {sigMode === 'draw' ? (
                <>
                  <div className="sig-box">
                    <SignatureCanvas
                      ref={sigRef}
                      penColor="#e8edf5"
                      backgroundColor="transparent"
                      canvasProps={{ className: 'touch-none w-full h-40' }}
                    />
                  </div>
                  <button type="button" onClick={() => sigRef.current?.clear()} className="btn-secondary mt-3">
                    ล้าง
                  </button>
                </>
              ) : (
                <input type="text" className="form-input"
                  placeholder="พิมพ์ชื่อแทนลายเซ็น เช่น สมชาย ใจดี"
                  value={sigText} onChange={(e) => setSigText(e.target.value)} />
              )}
            </div>
          </div>
        </SectionCard>

        {/* =============== Submit =============== */}
        <div className="animate-in" style={{ animationDelay: '360ms' }}>
          {/* Success */}
          {result?.success && (
            <div className="result-success mb-5">
              <p className="text-lg font-semibold" style={{ color: 'var(--success)' }}>
                ✓ ส่งรายงานสำเร็จ!
              </p>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                ส่งลิงก์นี้ให้อาจารย์นิเทศหรือเพื่อนได้เลย
              </p>
              {result.docUrl && (
                <a href={result.docUrl} target="_blank" rel="noopener noreferrer"
                  className="mt-4 inline-block rounded-md px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
                  style={{ background: 'var(--accent)' }}>
                  เปิด Google Docs →
                </a>
              )}
              <button type="button" onClick={resetForm}
                className="mt-4 block w-full text-center text-sm underline"
                style={{ color: 'var(--text-muted)' }}>
                กรอกรายงานใหม่
              </button>
            </div>
          )}

          {/* Error */}
          {result && !result.success && (
            <div className="result-error mb-5">
              <p className="text-sm font-medium" style={{ color: 'var(--error)' }}>
                เกิดข้อผิดพลาด: {result.error}
              </p>
            </div>
          )}

          {/* Submit button */}
          <button type="submit" disabled={isSubmitting} className="btn-primary">
            {isSubmitting ? (
              <>
                <span className="spinner" />
                กำลังสร้างเอกสาร...
              </>
            ) : result?.success ? (
              'ส่งรายงานอีกครั้ง'
            ) : (
              'ส่งรายงาน'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
