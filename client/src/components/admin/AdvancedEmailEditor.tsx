import React, { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import SyntaxHighlighter from "react-syntax-highlighter";
import { atomOneDark } from "react-syntax-highlighter/dist/esm/styles/hljs";
import { 
  Search, 
  X, 
  ChevronDown, 
  Copy, 
  FileCode,
  Palette,
  Type,
  Maximize2,
  Minimize2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ElementStyle {
  fontSize?: string;
  color?: string;
  fontFamily?: string;
  backgroundColor?: string;
  padding?: string;
  margin?: string;
  textAlign?: string;
  fontWeight?: string;
}

interface AdvancedEmailEditorProps {
  htmlContent: string;
  onHtmlChange: (html: string) => void;
  showSplitView?: boolean;
  onSplitViewChange?: (show: boolean) => void;
}

export function AdvancedEmailEditor({
  htmlContent,
  onHtmlChange,
  showSplitView: initialSplitView = true,
  onSplitViewChange,
}: AdvancedEmailEditorProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [selectedElement, setSelectedElement] = useState<HTMLElement | null>(null);
  const [selectedStyles, setSelectedStyles] = useState<ElementStyle>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMatches, setSearchMatches] = useState<number>(0);
  const [currentMatch, setCurrentMatch] = useState(0);
  const [showElementTree, setShowElementTree] = useState(false);
  const [elementTree, setElementTree] = useState<any[]>([]);
  const [showSplitView, setShowSplitViewLocal] = useState(initialSplitView);
  const [editMode, setEditMode] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const contentEditableSnapshot = useRef<string>("");

  const handleSplitViewChange = (value: boolean) => {
    setShowSplitViewLocal(value);
    onSplitViewChange?.(value);
  };

  // Update element tree when HTML changes
  useEffect(() => {
    if (iframeRef.current?.contentDocument) {
      const doc = iframeRef.current.contentDocument;
      const body = doc.body;
      const tree = buildElementTree(body);
      setElementTree(tree);
    }
  }, [htmlContent]);

  // Enable interactive element selection in preview
  useEffect(() => {
    if (iframeRef.current?.contentDocument && showSplitView) {
      const doc = iframeRef.current.contentDocument;
      const allElements = doc.querySelectorAll("*");

      allElements.forEach((el) => {
        el.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          handleElementClick(el as HTMLElement);
        });
        el.addEventListener("mouseover", () => {
          (el as HTMLElement).style.outline = "2px solid #667eea";
          (el as HTMLElement).style.outlineOffset = "-2px";
        });
        el.addEventListener("mouseout", () => {
          if (selectedElement !== el) {
            (el as HTMLElement).style.outline = "none";
          }
        });
      });
    }
  }, [htmlContent, showSplitView, selectedElement]);

  // Setup contenteditable for inline editing when in edit mode
  useEffect(() => {
    if (iframeRef.current?.contentDocument && editMode && showSplitView) {
      const doc = iframeRef.current.contentDocument;
      const editableSelectors = ["h1", "h2", "h3", "p", "a", "span", "div"];
      
      editableSelectors.forEach((selector) => {
        doc.querySelectorAll(selector).forEach((el: Element) => {
          const htmlEl = el as HTMLElement;
          
          // Skip elements with no text content
          if (!htmlEl.textContent?.trim()) return;
          
          htmlEl.contentEditable = "true";
          htmlEl.style.outline = "1px dashed #667eea";
          htmlEl.style.outlineOffset = "2px";
          htmlEl.style.cursor = "text";
          
          // Add focus listener for visual feedback
          htmlEl.addEventListener("focus", () => {
            htmlEl.style.outline = "2px solid #667eea";
            htmlEl.style.backgroundColor = "rgba(102, 126, 234, 0.05)";
          });
          
          htmlEl.addEventListener("blur", () => {
            htmlEl.style.outline = "1px dashed #667eea";
            htmlEl.style.backgroundColor = "transparent";
            
            // Sync changes back to HTML code
            if (iframeRef.current?.contentDocument) {
              const newHtml = iframeRef.current.contentDocument.documentElement.innerHTML;
              onHtmlChange(newHtml);
            }
          });
          
          // Prevent context menu on contenteditable
          htmlEl.addEventListener("contextmenu", (e) => e.stopPropagation());
        });
      });
    }
  }, [editMode, showSplitView, htmlContent, onHtmlChange]);

  const buildElementTree = (el: Element, depth = 0): any[] => {
    const children: any[] = [];
    for (let i = 0; i < el.children.length; i++) {
      const child = el.children[i];
      const tag = child.tagName.toLowerCase();
      const text = child.textContent?.substring(0, 50) || "";
      children.push({
        tag,
        text,
        depth,
        element: child,
        children: buildElementTree(child, depth + 1),
      });
    }
    return children;
  };

  const handleElementClick = (el: HTMLElement) => {
    if (selectedElement) {
      (selectedElement as HTMLElement).style.outline = "none";
    }
    el.style.outline = "2px solid #2C3E2D";
    el.style.outlineOffset = "-2px";
    setSelectedElement(el);

    // Extract current styles
    const styles = window.getComputedStyle(el);
    setSelectedStyles({
      fontSize: styles.fontSize,
      color: styles.color,
      fontFamily: styles.fontFamily,
      backgroundColor: styles.backgroundColor,
      padding: styles.padding,
      margin: styles.margin,
      textAlign: styles.textAlign,
      fontWeight: styles.fontWeight,
    });
  };

  const handleStyleChange = (property: keyof ElementStyle, value: string) => {
    if (selectedElement) {
      (selectedElement as any).style[
        property.replace(/([A-Z])/g, "-$1").toLowerCase()
      ] = value;
      setSelectedStyles((prev) => ({ ...prev, [property]: value }));
      
      // Update HTML content
      if (iframeRef.current?.contentDocument) {
        const newHtml = iframeRef.current.contentDocument.documentElement.innerHTML;
        onHtmlChange(newHtml);
      }
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (!query) {
      setSearchMatches(0);
      setCurrentMatch(0);
      return;
    }

    if (textareaRef.current) {
      const text = textareaRef.current.value;
      const regex = new RegExp(query, "gi");
      const matches = text.match(regex);
      setSearchMatches(matches?.length || 0);
    }
  };

  const findNextMatch = () => {
    if (searchMatches === 0) return;
    const text = textareaRef.current?.value || "";
    const regex = new RegExp(searchQuery, "gi");
    let match;
    let matchCount = 0;
    const targetMatch = (currentMatch + 1) % searchMatches;

    while ((match = regex.exec(text)) !== null) {
      if (matchCount === targetMatch) {
        textareaRef.current?.setSelectionRange(match.index, match.index + searchQuery.length);
        textareaRef.current?.focus();
        setCurrentMatch(targetMatch);
        break;
      }
      matchCount++;
    }
  };

  const copyHtmlToClipboard = () => {
    navigator.clipboard.writeText(htmlContent);
  };

  const handleLineNumbers = () => {
    if (editorRef.current) {
      const lines = htmlContent.split("\n").length;
      return Array.from({ length: lines }, (_, i) => i + 1).join("\n");
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 p-3 bg-muted/20 rounded-lg border border-[#E5E5E0] dark:border-border">
        <div className="flex items-center gap-2 flex-1">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search in HTML..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="h-8 text-xs flex-1"
          />
          {searchMatches > 0 && (
            <span className="text-xs text-muted-foreground">
              {currentMatch + 1} of {searchMatches}
            </span>
          )}
          {searchMatches > 0 && (
            <Button size="sm" variant="ghost" onClick={findNextMatch} className="h-7">
              Next
            </Button>
          )}
        </div>
        <Button size="sm" variant="ghost" onClick={copyHtmlToClipboard} title="Copy HTML">
          <Copy className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowElementTree(!showElementTree)}
          title="Element Tree"
        >
          <FileCode className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => handleSplitViewChange(!showSplitView)}
          title={showSplitView ? "Compact View" : "Split View"}
        >
          {showSplitView ? (
            <Minimize2 className="h-3.5 w-3.5" />
          ) : (
            <Maximize2 className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>

      {showSplitView ? (
        <div className="grid grid-cols-2 gap-4 h-[600px]">
          {/* Editor Panel with Syntax Highlighting */}
          <div className="flex flex-col space-y-2 border border-[#E5E5E0] dark:border-border rounded-lg overflow-hidden bg-[#282c34]">
            <div className="flex items-center justify-between p-2 bg-[#1e1f26] border-b border-[#3e3f47]">
              <span className="text-xs text-gray-400 font-mono">HTML</span>
              <input
                type="file"
                accept=".html,.htm"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (evt) => onHtmlChange(evt.target?.result as string);
                    reader.readAsText(file);
                  }
                }}
                className="hidden"
                id="htmlFileInputSplit"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => document.getElementById("htmlFileInputSplit")?.click()}
                className="h-6 px-2 text-[10px]"
              >
                <FileCode className="h-3 w-3" />
              </Button>
            </div>
            <div className="flex-1 overflow-auto">
              <div className="flex">
                {/* Line Numbers */}
                <div className="bg-[#1e1f26] text-gray-500 text-right pr-4 py-3 font-mono text-xs leading-6 border-r border-[#3e3f47] select-none">
                  {handleLineNumbers()?.split("\n").map((n) => (
                    <div key={n}>{n}</div>
                  ))}
                </div>
                {/* Code with Syntax Highlighting */}
                <div className="flex-1 p-3 overflow-auto">
                  <SyntaxHighlighter
                    language="html"
                    style={atomOneDark}
                    customStyle={{
                      margin: 0,
                      padding: 0,
                      background: "transparent",
                      fontSize: "12px",
                      lineHeight: "1.5",
                    }}
                    wrapLongLines
                  >
                    {htmlContent}
                  </SyntaxHighlighter>
                </div>
              </div>
            </div>
          </div>

          {/* Preview Panel with Element Inspector */}
          <div className="flex flex-col space-y-2 border border-[#E5E5E0] dark:border-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between p-2 bg-muted/30 border-b border-[#E5E5E0] dark:border-border">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground">Edit Template</span>
                <Button
                  size="sm"
                  variant={editMode ? "default" : "outline"}
                  onClick={() => setEditMode(!editMode)}
                  className="h-6 px-2 text-[10px]"
                  title={editMode ? "Disable inline editing" : "Enable inline editing"}
                >
                  {editMode ? "Editing ON" : "Editing OFF"}
                </Button>
              </div>
              {selectedElement && !editMode && (
                <span className="text-xs text-muted-foreground">
                  &lt;{selectedElement.tagName.toLowerCase()}&gt; selected
                </span>
              )}
            </div>
            <div className="flex-1 overflow-auto bg-white dark:bg-slate-900 rounded">
              <iframe
                ref={iframeRef}
                srcDoc={htmlContent}
                className="w-full h-full border-0"
                title="Email Preview"
              />
            </div>
          </div>
        </div>
      ) : (
        /* Compact View */
        <div className="space-y-3">
          {/* Syntax Highlighted Editor */}
          <div className="border border-[#E5E5E0] dark:border-border rounded-lg overflow-hidden bg-[#282c34]">
            <div className="flex items-center justify-between p-2 bg-[#1e1f26] border-b border-[#3e3f47]">
              <span className="text-xs text-gray-400 font-mono">HTML</span>
              <input
                type="file"
                accept=".html,.htm"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (evt) => onHtmlChange(evt.target?.result as string);
                    reader.readAsText(file);
                  }
                }}
                className="hidden"
                id="htmlFileInputCompact"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => document.getElementById("htmlFileInputCompact")?.click()}
                className="h-6 px-2 text-[10px]"
              >
                <FileCode className="h-3 w-3" />
              </Button>
            </div>
            <div className="h-[400px] overflow-auto flex">
              {/* Line Numbers */}
              <div className="bg-[#1e1f26] text-gray-500 text-right pr-4 py-3 font-mono text-xs leading-6 border-r border-[#3e3f47] select-none min-w-fit">
                {handleLineNumbers()?.split("\n").map((n) => (
                  <div key={n}>{n}</div>
                ))}
              </div>
              {/* Code Editor with Highlighting */}
              <div className="flex-1 p-3 font-mono text-xs overflow-auto">
                <SyntaxHighlighter
                  language="html"
                  style={atomOneDark}
                  customStyle={{
                    margin: 0,
                    padding: 0,
                    background: "transparent",
                    fontSize: "12px",
                    lineHeight: "1.5",
                  }}
                  wrapLongLines
                >
                  {htmlContent}
                </SyntaxHighlighter>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Element Style Panel (appears when element is selected in split view) */}
      {selectedElement && showSplitView && (
        <div className="border border-[#E5E5E0] dark:border-border rounded-lg p-4 bg-muted/20 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Style Inspector</h4>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedElement(null)}
              className="h-6 px-2"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Font Size */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <Type className="h-3 w-3" /> Size
              </label>
              <Input
                type="text"
                value={selectedStyles.fontSize || ""}
                onChange={(e) => handleStyleChange("fontSize", e.target.value)}
                placeholder="e.g., 16px"
                className="h-8 text-xs"
              />
            </div>

            {/* Color */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <Palette className="h-3 w-3" /> Color
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={rgbToHex(selectedStyles.color || "#000000")}
                  onChange={(e) => handleStyleChange("color", e.target.value)}
                  className="h-8 w-12 rounded cursor-pointer"
                />
                <Input
                  type="text"
                  value={selectedStyles.color || ""}
                  onChange={(e) => handleStyleChange("color", e.target.value)}
                  className="h-8 text-xs flex-1"
                />
              </div>
            </div>

            {/* Font Family */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Font</label>
              <select
                value={selectedStyles.fontFamily || ""}
                onChange={(e) => handleStyleChange("fontFamily", e.target.value)}
                className="h-8 text-xs border border-[#E5E5E0] dark:border-border rounded-md px-2 w-full"
              >
                <option value="">Default</option>
                <option value="Arial, sans-serif">Arial</option>
                <option value="'Times New Roman', serif">Times New Roman</option>
                <option value="Georgia, serif">Georgia</option>
                <option value="'Courier New', monospace">Courier</option>
                <option value="Verdana, sans-serif">Verdana</option>
                <option value="'Trebuchet MS', sans-serif">Trebuchet</option>
              </select>
            </div>

            {/* Background Color */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Background</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={rgbToHex(selectedStyles.backgroundColor || "#ffffff")}
                  onChange={(e) => handleStyleChange("backgroundColor", e.target.value)}
                  className="h-8 w-12 rounded cursor-pointer"
                />
                <Input
                  type="text"
                  value={selectedStyles.backgroundColor || ""}
                  onChange={(e) => handleStyleChange("backgroundColor", e.target.value)}
                  className="h-8 text-xs flex-1"
                />
              </div>
            </div>

            {/* Padding */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Padding</label>
              <Input
                type="text"
                value={selectedStyles.padding || ""}
                onChange={(e) => handleStyleChange("padding", e.target.value)}
                placeholder="e.g., 10px 20px"
                className="h-8 text-xs"
              />
            </div>

            {/* Margin */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Margin</label>
              <Input
                type="text"
                value={selectedStyles.margin || ""}
                onChange={(e) => handleStyleChange("margin", e.target.value)}
                placeholder="e.g., 10px auto"
                className="h-8 text-xs"
              />
            </div>

            {/* Font Weight */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Weight</label>
              <select
                value={selectedStyles.fontWeight || ""}
                onChange={(e) => handleStyleChange("fontWeight", e.target.value)}
                className="h-8 text-xs border border-[#E5E5E0] dark:border-border rounded-md px-2 w-full"
              >
                <option value="">Normal</option>
                <option value="300">Light</option>
                <option value="400">Normal</option>
                <option value="500">Medium</option>
                <option value="600">Semi Bold</option>
                <option value="700">Bold</option>
                <option value="800">Extra Bold</option>
              </select>
            </div>

            {/* Text Align */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Alignment</label>
              <select
                value={selectedStyles.textAlign || ""}
                onChange={(e) => handleStyleChange("textAlign", e.target.value)}
                className="h-8 text-xs border border-[#E5E5E0] dark:border-border rounded-md px-2 w-full"
              >
                <option value="">Default</option>
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
                <option value="justify">Justify</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Element Tree Sidebar */}
      {showElementTree && (
        <Dialog open={showElementTree} onOpenChange={setShowElementTree}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Element Tree</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 max-h-[400px] overflow-auto font-mono text-xs">
              {renderElementTree(elementTree)}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function renderElementTree(elements: any[]): React.ReactNode {
  return (
    <div className="space-y-1">
      {elements.map((el, idx) => (
        <div key={idx} style={{ paddingLeft: `${el.depth * 16}px` }}>
          <div className="text-xs hover:bg-muted p-1 rounded cursor-pointer">
            <span className="text-blue-600 dark:text-blue-400">&lt;{el.tag}&gt;</span>
            {el.text && (
              <span className="text-gray-600 dark:text-gray-400 ml-2">
                {el.text.length > 30 ? el.text.substring(0, 30) + "..." : el.text}
              </span>
            )}
          </div>
          {el.children && renderElementTree(el.children)}
        </div>
      ))}
    </div>
  );
}

function rgbToHex(rgb: string): string {
  if (rgb.startsWith("#")) return rgb;
  const result = rgb.match(/\d+/g);
  if (!result || result.length < 3) return "#000000";
  const hex = (x: string) => {
    const hex = parseInt(x).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };
  return `#${hex(result[0])}${hex(result[1])}${hex(result[2])}`;
}
