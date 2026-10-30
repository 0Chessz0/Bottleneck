const { test } = require('node:test');
const assert = require('node:assert/strict');
const { plain, requirementGb } = require('../dist/requirements.js');
test('Steam requirement HTML keeps separate fields', () => {
  const text = plain('<strong>Minimum:</strong><br><ul><li><strong>Memory:</strong> 12 GB RAM</li><li><strong>Storage:</strong> 70 GB available space</li></ul>');
  assert.equal(requirementGb(text,'Memory'),12);
  assert.equal(requirementGb(text,'Storage'),70);
});
test('missing values stay unknown and units are converted', () => {
  assert.equal(requirementGb('Memory: TBD','Memory'),null);
  assert.equal(requirementGb('Memory: 512 MB RAM','Memory'),.5);
  assert.equal(requirementGb('Storage: 1.5 TB','Storage'),1536);
  assert.equal(requirementGb('Graphics: 8 GB VRAM','Memory'),null);
});
