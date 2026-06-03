import { NextRequest, NextResponse } from 'next/server';
import { Readable } from 'stream';

/* -------------------------------------------------------------------------- */
/*  Runtime                                                                   */
/* -------------------------------------------------------------------------- */
export const runtime = 'nodejs';

/* -------------------------------------------------------------------------- */
/*  Google Auth                                                               */
/* -------------------------------------------------------------------------- */

async function getGoogleClients() {
  const { google } = await import('googleapis');

  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  const templateId = process.env.GOOGLE_DOCS_TEMPLATE_ID;

  if (!folderId || !templateId) {
    throw new Error(
      'กรุณาตั้งค่า GOOGLE_DRIVE_FOLDER_ID และ GOOGLE_DOCS_TEMPLATE_ID ใน .env.local',
    );
  }

  // 1. Try OAuth2 with Refresh Token (for personal @gmail.com accounts)
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (clientId && clientSecret && refreshToken) {
    const auth = new google.auth.OAuth2(clientId, clientSecret);
    auth.setCredentials({ refresh_token: refreshToken });

    const drive = google.drive({ version: 'v3', auth });
    const docs = google.docs({ version: 'v1', auth });

    return { drive, docs, folderId, templateId };
  }

  // 2. Fallback to Service Account (for Workspace Shared Drives)
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!email || !rawKey) {
    throw new Error(
      'กรุณาตั้งค่าความปลอดภัย Google ใน .env.local โดยกำหนดเป็น GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN (สำหรับบัญชีส่วนตัว) หรือ GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY (สำหรับ Service Account)',
    );
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: email,
      private_key: rawKey.replace(/\\n/g, '\n'),
    },
    scopes: [
      'https://www.googleapis.com/auth/documents',
      'https://www.googleapis.com/auth/drive',
    ],
  });

  const drive = google.drive({ version: 'v3', auth });
  const docs = google.docs({ version: 'v1', auth });

  return { drive, docs, folderId, templateId };
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function txt(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === 'string' ? v : '';
}

function decodeDataUrl(dataUrl: string) {
  const m = /^data:(.+?);base64,(.*)$/.exec(dataUrl.trim());
  if (!m) return null;
  return { contentType: m[1], buffer: Buffer.from(m[2], 'base64') };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findParagraphs(elements: any[]): any[] {
  const paragraphs: any[] = [];
  for (const element of elements) {
    if (element.paragraph) {
      paragraphs.push(element.paragraph);
    } else if (element.table) {
      for (const row of element.table.tableRows ?? []) {
        for (const cell of row.tableCells ?? []) {
          paragraphs.push(...findParagraphs(cell.content ?? []));
        }
      }
    } else if (element.tableOfContents) {
      paragraphs.push(...findParagraphs(element.tableOfContents.content ?? []));
    }
  }
  return paragraphs;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function uploadToDrive(drive: any, folderId: string, buffer: Buffer, mimeType: string, filename: string): Promise<{ id: string; url: string }> {
  const file = await drive.files.create({
    requestBody: { name: filename, parents: [folderId] },
    media: { mimeType, body: Readable.from(buffer) },
    fields: 'id',
    supportsAllDrives: true,
  });
  const fileId = file.data.id as string;

  await drive.permissions.create({
    fileId,
    requestBody: { role: 'reader', type: 'anyone' },
    supportsAllDrives: true,
  });

  // รอให้สิทธิ์การเข้าถึงแบบสาธารณะแพร่กระจายไปยังระบบของ Google (ป้องกันปัญหา Google Docs ดึงภาพไม่ทัน)
  await new Promise((resolve) => setTimeout(resolve, 2000));

  return {
    id: fileId,
    url: `https://drive.google.com/uc?export=view&id=${fileId}`,
  };
}

/* -------------------------------------------------------------------------- */
/*  Template Placeholders (ตรงกับ template V2)                                */
/* -------------------------------------------------------------------------- */
/*                                                                            */
/*  {{student_name}}          {{task_monday}}      {{completed_work}}          */
/*  {{student_id}}            {{task_tuesday}}     {{learnings}}               */
/*  {{class_room}}            {{task_wednesday}}   {{problems}}                */
/*  {{company_name}}          {{task_thursday}}    {{solutions}}               */
/*  {{week_number}}           {{task_friday}}      {{weekly_summary}}          */
/*  {{start_date}}            {{task_saturday}}    {{supervisor_comments}}     */
/*  {{end_date}}              {{supervisor_position}}  {{signed_date}}         */
/*  {{supervisor_name}}       {{image_desc_1/2/3}}     {{signature_image}}     */
/*  {{image_1/2/3}}                                                            */
/*                                                                            */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/*  POST Handler                                                              */
/* -------------------------------------------------------------------------- */

export async function POST(request: NextRequest) {
  const uploadedFileIds: string[] = [];
  let dr: any = null;

  try {
    const { drive, docs, folderId, templateId } = await getGoogleClients();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dr = drive as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dc = docs as any;

    /* 1. Parse FormData --------------------------------------------------- */
    const form = await request.formData();

    const studentName = txt(form, 'studentName');
    const studentId = txt(form, 'studentId');
    const classRoom = txt(form, 'classRoom');
    const companyName = txt(form, 'companyName');
    const weekNumber = txt(form, 'weekNumber');
    const startDate = txt(form, 'startDate');
    const endDate = txt(form, 'endDate');

    const taskMonday = txt(form, 'taskMonday');
    const taskTuesday = txt(form, 'taskTuesday');
    const taskWednesday = txt(form, 'taskWednesday');
    const taskThursday = txt(form, 'taskThursday');
    const taskFriday = txt(form, 'taskFriday');
    const taskSaturday = txt(form, 'taskSaturday');

    const completedWork = txt(form, 'completedWork');
    const learnings = txt(form, 'learnings');
    const problems = txt(form, 'problems');
    const solutions = txt(form, 'solutions');
    const weeklySummary = txt(form, 'weeklySummary');

    const supervisorComments = txt(form, 'supervisorComments');
    const supervisorName = txt(form, 'supervisorName');
    const supervisorPosition = txt(form, 'supervisorPosition');
    const signedDate = txt(form, 'signedDate');

    const imageDesc1 = txt(form, 'imageDesc1');
    const imageDesc2 = txt(form, 'imageDesc2');
    const imageDesc3 = txt(form, 'imageDesc3');

    const signatureMode = txt(form, 'signatureMode'); // 'draw' | 'text'
    const signatureText = txt(form, 'signatureText');
    const signatureImageRaw = txt(form, 'signatureImage');

    /* 1.5. Create or Find Student Folder ---------------------------------- */
    let studentFolderId = folderId;
    if (studentName) {
      const q = `mimeType='application/vnd.google-apps.folder' and '${folderId}' in parents and name='${studentName.replace(/'/g, "\\'")}' and trashed=false`;
      const res = await dr.files.list({
        q,
        spaces: 'drive',
        fields: 'files(id)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      if (res.data.files && res.data.files.length > 0) {
        studentFolderId = res.data.files[0].id;
      } else {
        const newFolder = await dr.files.create({
          requestBody: {
            name: studentName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [folderId],
          },
          fields: 'id',
          supportsAllDrives: true,
        });
        studentFolderId = newFolder.data.id;
      }
    }

    /* 2. Upload images to Google Drive ------------------------------------ */
    const imageSlots: (string | null)[] = [null, null, null];
    for (let i = 1; i <= 3; i++) {
      const file = form.get(`image_${i}`);
      if (file instanceof File && file.size > 0) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const ext = file.name.split('.').pop() || 'png';
        const name = `w${weekNumber}-img${i}-${Date.now()}.${ext}`;
        const result = await uploadToDrive(dr, studentFolderId, buffer, file.type || 'image/png', name);
        imageSlots[i - 1] = result.url;
        uploadedFileIds.push(result.id);
      }
    }

    /* 3. Upload signature (draw mode) ------------------------------------- */
    let signatureUrl: string | null = null;
    if (signatureMode === 'draw' && signatureImageRaw) {
      const decoded = decodeDataUrl(signatureImageRaw);
      if (decoded) {
        const result = await uploadToDrive(
          dr, studentFolderId, decoded.buffer, decoded.contentType,
          `w${weekNumber}-sig-${Date.now()}.png`,
        );
        signatureUrl = result.url;
        uploadedFileIds.push(result.id);
      }
    }

    /* 4. Copy the template ------------------------------------------------ */
    const copy = await dr.files.copy({
      fileId: templateId,
      requestBody: {
        name: `รายงานฝึกงาน สัปดาห์ที่ ${weekNumber} — ${studentName}`,
        parents: [studentFolderId],
      },
      fields: 'id',
      supportsAllDrives: true,
    });
    const docId: string = copy.data.id;

    /* 5. Pass 1 — Replace all TEXT placeholders --------------------------- */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const textReplacements: [string, string][] = [
      ['{{student_name}}', studentName],
      ['{{student_id}}', studentId],
      ['{{class_room}}', classRoom],
      ['{{company_name}}', companyName],
      ['{{week_number}}', weekNumber],
      ['{{start_date}}', startDate],
      ['{{end_date}}', endDate],
      ['{{task_monday}}', taskMonday],
      ['{{task_tuesday}}', taskTuesday],
      ['{{task_wednesday}}', taskWednesday],
      ['{{task_thursday}}', taskThursday],
      ['{{task_friday}}', taskFriday],
      ['{{task_saturday}}', taskSaturday],
      ['{{completed_work}}', completedWork],
      ['{{learnings}}', learnings],
      ['{{problems}}', problems],
      ['{{solutions}}', solutions],
      ['{{weekly_summary}}', weeklySummary],
      ['{{supervisor_comments}}', supervisorComments],
      ['{{supervisor_name}}', supervisorName],
      ['{{supervisor_position}}', supervisorPosition],
      ['{{signed_date}}', signedDate],
      ['{{image_desc_1}}', imageDesc1],
      ['{{image_desc_2}}', imageDesc2],
      ['{{image_desc_3}}', imageDesc3],
    ];

    // Image placeholders WITHOUT an uploaded file → replace with empty text
    for (let i = 0; i < 3; i++) {
      if (!imageSlots[i]) {
        textReplacements.push([`{{image_${i + 1}}}`, '']);
      }
    }

    // Signature
    if (signatureMode === 'text') {
      // Text signature → just replace with the typed text
      textReplacements.push(['{{signature_image}}', signatureText || '—']);
    } else if (!signatureUrl) {
      // Draw mode but no drawing → replace with empty
      textReplacements.push(['{{signature_image}}', '—']);
    }

    const textRequests = textReplacements.map(([placeholder, value]) => ({
      replaceAllText: {
        containsText: { text: placeholder, matchCase: true },
        replaceText: value || '',
      },
    }));

    await dc.documents.batchUpdate({
      documentId: docId,
      requestBody: { requests: textRequests },
    });

    /* 6. Pass 2 — Replace IMAGE placeholders with actual images ----------- */
    // Collect remaining image placeholders (those that have uploaded files)
    interface ImageTarget {
      placeholder: string;
      url: string;
      width: number;
      height: number;
    }

    const imageTargets: ImageTarget[] = [];

    for (let i = 0; i < 3; i++) {
      if (imageSlots[i]) {
        imageTargets.push({
          placeholder: `{{image_${i + 1}}}`,
          url: imageSlots[i]!,
          width: 350,
          height: 240,
        });
      }
    }

    if (signatureMode === 'draw' && signatureUrl) {
      imageTargets.push({
        placeholder: '{{signature_image}}',
        url: signatureUrl,
        width: 180,
        height: 70,
      });
    }

    if (imageTargets.length > 0) {
      // Read the document to find placeholder positions
      const docData = await dc.documents.get({ documentId: docId });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body: any[] = docData.data.body?.content ?? [];
      const paragraphs = findParagraphs(body);

      interface FoundPos {
        startIndex: number;
        endIndex: number;
        url: string;
        width: number;
        height: number;
      }

      const found: FoundPos[] = [];

      for (const target of imageTargets) {
        for (const paragraph of paragraphs) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          for (const pe of (paragraph.elements ?? []) as any[]) {
            const content: string | undefined = pe.textRun?.content;
            if (content && content.includes(target.placeholder)) {
              const offset = content.indexOf(target.placeholder);
              found.push({
                startIndex: pe.startIndex + offset,
                endIndex: pe.startIndex + offset + target.placeholder.length,
                url: target.url,
                width: target.width,
                height: target.height,
              });
              break;
            }
          }
        }
      }

      if (found.length > 0) {
        // Process from highest index to lowest so positions don't shift
        found.sort((a, b) => b.startIndex - a.startIndex);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const imgRequests: any[] = [];
        for (const pos of found) {
          // 1. Delete the placeholder text
          imgRequests.push({
            deleteContentRange: {
              range: { startIndex: pos.startIndex, endIndex: pos.endIndex },
            },
          });
          // 2. Insert image at the same position
          imgRequests.push({
            insertInlineImage: {
              location: { index: pos.startIndex },
              uri: pos.url,
              objectSize: {
                width: { magnitude: pos.width, unit: 'PT' },
                height: { magnitude: pos.height, unit: 'PT' },
              },
            },
          });
        }

        await dc.documents.batchUpdate({
          documentId: docId,
          requestBody: { requests: imgRequests },
        });
      }
    }

    /* 7. Set doc viewable by anyone with the link ------------------------- */
    await dr.permissions.create({
      fileId: docId,
      requestBody: { role: 'reader', type: 'anyone' },
      supportsAllDrives: true,
    });

    /* 8. Return the doc URL ----------------------------------------------- */
    const docUrl = `https://docs.google.com/document/d/${docId}/edit`;
    console.log(`✅ Report created: ${docUrl}`);

    return NextResponse.json(
      { success: true, message: 'สร้างรายงานสำเร็จ', docUrl },
      { status: 201 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
    console.error('❌ Weekly report submission failed:', err);

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  } finally {
    // Commented out to prevent deleting images before Google Docs finishes downloading/embedding them.
    /*
    if (dr && uploadedFileIds.length > 0) {
      console.log(`🧹 Starting cleanup of ${uploadedFileIds.length} temporary image files...`);
      await Promise.all(
        uploadedFileIds.map(async (id) => {
          try {
            await dr.files.delete({ fileId: id, supportsAllDrives: true });
            console.log(`🗑️ Deleted temporary image from Drive: ${id}`);
          } catch (deleteErr) {
            console.warn(`⚠️ Failed to delete temporary image ${id}:`, deleteErr);
          }
        }),
      );
    }
    */
  }
}
