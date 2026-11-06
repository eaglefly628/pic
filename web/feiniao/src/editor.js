import {Editor,Extension,Node,mergeAttributes} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import {fonts,fromPlainText,validDocument,renderDocument,appearance,safeLink} from './rich-document.js';
const FontSize=Extension.create({name:'fontSize',addGlobalAttributes(){return [{types:['textStyle'],attributes:{fontSize:{default:null,parseHTML:el=>el.style.fontSize,renderHTML:a=>a.fontSize?{style:`font-size: ${a.fontSize}`}:{}}}}];}});
export function createRichEditor(element,onUpdate,resolveMedia=async()=>null){
 const assetUrls=new Set();let generation=0,writingMode='blog';
 const CloudMedia=Node.create({
  name:'cloudMedia',group:'block',atom:true,draggable:true,
  addAttributes(){return {id:{default:''},name:{default:''},mime:{default:''},size:{default:0}};},
  parseHTML(){return [];},renderHTML({HTMLAttributes}){return ['figure',mergeAttributes(HTMLAttributes,{'data-cloud-attachment':'true'})];},
  addNodeView(){return ({node})=>{const current=generation,dom=document.createElement('figure');dom.className='editor-cloud-media';dom.contentEditable='false';const caption=document.createElement('figcaption');caption.textContent=node.attrs.name;const status=document.createElement('span');status.textContent='正在读取附件…';dom.append(status,caption);let disposed=false,assetUrl;resolveMedia(node.attrs).then(blob=>{if(disposed||current!==generation||!blob)return;assetUrl=URL.createObjectURL(blob);assetUrls.add(assetUrl);const type=node.attrs.mime.split('/')[0],el=document.createElement(type==='image'?'img':type);if(!['image','audio','video'].includes(type))return;el.src=assetUrl;if(type==='image')el.alt=node.attrs.name;else{el.controls=true;el.preload='metadata';if(type==='video')el.playsInline=true;}status.replaceWith(el);}).catch(()=>{if(!disposed)status.textContent='附件加载失败，可重新打开重试。';});return {dom,stopEvent:event=>!!event.target.closest('audio,video'),destroy(){disposed=true;if(assetUrl){URL.revokeObjectURL(assetUrl);assetUrls.delete(assetUrl);}}};};}
 });
 const editor=new Editor({element,extensions:[StarterKit.configure({heading:{levels:[1,2,3]}}),TextStyle,Color,FontFamily,FontSize,Highlight.configure({multicolor:true}),TextAlign.configure({types:['heading','paragraph']}),Link.configure({openOnClick:false,autolink:false,linkOnPaste:true,validate:safeLink}),Underline,TaskList,TaskItem.configure({nested:true}),Placeholder.configure({placeholder:()=>writingMode==='poetry'?'从第一行写起…':writingMode==='ci'?'填写的词句会写入这里…':'开始写正文…'}),CloudMedia],content:fromPlainText(''),editorProps:{attributes:{class:'rich-content',role:'textbox','aria-label':'正文编辑器','aria-multiline':'true',spellcheck:'false'},handleKeyDown(view,event){if(event.key!=='Enter'||writingMode==='blog'||event.isComposing||event.ctrlKey||event.metaKey)return false;event.preventDefault();if(event.shiftKey)editor.commands.splitBlock();else editor.commands.setHardBreak();return true;},handlePaste(view,event){const html=event.clipboardData?.getData('text/html');if(html&&/<(?:script|iframe|object|img|video|audio)\b/i.test(html)){event.preventDefault();const text=event.clipboardData.getData('text/plain');editor.commands.insertContent(fromPlainText(text).content);return true;}return false;}},onUpdate(){onUpdate?.();},onSelectionUpdate(){document.dispatchEvent(new Event('feiniao:selection'));}});
 return {
  editor,
  setMode(mode){writingMode=mode;},
  load(record){generation++;for(const url of assetUrls)URL.revokeObjectURL(url);assetUrls.clear();let content=validDocument(record?.document)?record.document:fromPlainText(record?.body||'');try{editor.commands.setContent(content,false);}catch{editor.commands.setContent(fromPlainText(record?.body||''),false);}},
  document:()=>editor.getJSON(),text:()=>editor.getText({blockSeparator:'\n\n'}),
  clear(){generation++;editor.commands.clearContent(false);for(const url of assetUrls)URL.revokeObjectURL(url);assetUrls.clear();},
  insertMedia(media){editor.chain().focus(undefined,{scrollIntoView:false}).insertContent({type:'cloudMedia',attrs:media}).createParagraphNear().run();},
  removeMedia(id){const ranges=[];editor.state.doc.descendants((node,pos)=>{if(node.type.name==='cloudMedia'&&node.attrs.id===id)ranges.push([pos,pos+node.nodeSize]);});const transaction=editor.state.tr;for(const [from,to] of ranges.reverse())transaction.delete(from,to);editor.view.dispatch(transaction);},
  destroy(){editor.destroy();for(const url of assetUrls)URL.revokeObjectURL(url);assetUrls.clear();}
 };
}
globalThis.FeiniaoRich={createRichEditor,fonts,renderDocument,appearance,validDocument,fromPlainText,safeLink};

import './studio.js';
