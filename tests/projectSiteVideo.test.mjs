import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeProjectSiteVideo, PROJECT_SITE_VIDEO_HEADER } from '../src/utils/projectSiteVideo.js';

const id = '1obzLMUEVUyb2n7t1yv_PU6K4Ak4_bE_X';
test('project video links accept Drive files and retain resource-key access', () => {
  assert.equal(normalizeProjectSiteVideo(''), '');
  assert.equal(normalizeProjectSiteVideo(` https://drive.google.com/file/d/${id}/view?usp=sharing `), `https://drive.google.com/file/d/${id}/view`);
  assert.equal(normalizeProjectSiteVideo(`https://drive.google.com/open?id=${id}&resourcekey=shared-key`), `https://drive.google.com/file/d/${id}/view?resourcekey=shared-key`);
});
test('project video links reject folders, executable URLs and other hosts', () => {
  for (const url of ['javascript:alert(1)', 'https://example.com/video.mp4', `https://drive.google.com/drive/folders/${id}`, `https://drive.google.com.evil.test/file/d/${id}/view`]) {
    assert.throws(() => normalizeProjectSiteVideo(url), /Google Drive file link/);
  }
});
test('project forms and server include the same video field without disturbing older headers', async () => {
  assert.equal(PROJECT_SITE_VIDEO_HEADER, 'Completed Site Video URL');
  const server = await readFile(new URL('../api/_handlers/projects.js', import.meta.url), 'utf8');
  const client = await readFile(new URL('../src/components/ProjectTable.js', import.meta.url), 'utf8');
  assert.match(server, /Object\.prototype\.hasOwnProperty\.call\(payload, PROJECT_SITE_VIDEO_HEADER\)/);
  assert.match(server, /const headers = \[\.\.\.auditHeaders, \.\.\.missing\]/);
  assert.match(client, /Watch Site Video/);
  assert.match(client, /normalizeProjectSiteVideo\(editingRow\?\.\[PROJECT_SITE_VIDEO_HEADER\]\)/);
});
