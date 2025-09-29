// src/utils/sanitizeHtml.js
import DOMPurify from 'dompurify';

const config = {
  ALLOWED_TAGS: [
    'a','abbr','b','blockquote','br','cite','code','div','em','i','img','li','ol','p','pre','s','span','strong','sub','sup','u','ul',
    'h1','h2','h3','h4','h5','h6','hr','table','thead','tbody','tfoot','tr','td','th','figure','figcaption'
  ],
  ALLOWED_ATTR: [
    'href','target','rel','id','name','class','style','src','width','height','rowspan','colspan','align','title','alt'
  ],
  ALLOW_DATA_ATTR: false,
  FORBID_TAGS: ['script','style'],
  RETURN_TRUSTED_TYPE: false
};

export function sanitizeHtml(html) {
  return DOMPurify.sanitize(html || '', config);
}