# ComfyUI-Style UI Design System

## 1. Overview

This document defines the complete CSS design system for the AI Workflow Studio, inspired by ComfyUI's clean, dark-themed aesthetic.

### Design Principles

- Dark theme primary (like ComfyUI)
- Minimal, functional design
- Clear visual hierarchy
- Consistent spacing and sizing
- Icon-driven interface

---

## 2. Color Palette

### 2.1 Base Colors (ComfyUI-style dark theme)

| Token           | Hex       | Usage             |
| --------------- | --------- | ----------------- |
| `--bg-base`     | `#1e1e1e` | Main background   |
| `--bg-elevated` | `#252525` | Cards, panels     |
| `--bg-hover`    | `#2d2d2d` | Hover states      |
| `--bg-active`   | `#383838` | Active/selected   |
| `--bg-input`    | `#171717` | Input backgrounds |

### 2.2 Border Colors

| Token            | Hex       | Usage           |
| ---------------- | --------- | --------------- |
| `--border`       | `#404040` | Default borders |
| `--border-light` | `#333333` | Subtle borders  |
| `--border-focus` | `#5b8def` | Focus state     |

### 2.3 Text Colors

| Token              | Hex       | Usage          |
| ------------------ | --------- | -------------- |
| `--text-primary`   | `#e0e0e0` | Primary text   |
| `--text-secondary` | `#a0a0a0` | Secondary text |
| `--text-muted`     | `#6b6b6b` | Muted/disabled |
| `--text-accent`    | `#5b8def` | Links, accent  |

### 2.4 Accent Colors

| Token            | Hex       | Usage                  |
| ---------------- | --------- | ---------------------- |
| `--accent`       | `#5b8def` | Primary actions, links |
| `--accent-hover` | `#6b9fff` | Hover state            |
| `--accent-muted` | `#3d5a9e` | Subtle accent          |
| `--success`      | `#4ade80` | Success states         |
| `--warning`      | `#fbbf24` | Warnings               |
| `--error`        | `#f87171` | Errors                 |
| `--purple`       | `#a78bfa` | Special indicators     |

### 2.5 Status Colors

| Status  | Background | Text      |
| ------- | ---------- | --------- |
| Running | `#3d5a9e`  | `#8ab4ff` |
| Success | `#1f3d1f`  | `#4ade80` |
| Warning | `#3d3a1f`  | `#fbbf24` |
| Error   | `#3d1f1f`  | `#f87171` |
| Draft   | `#2d2d2d`  | `#a0a0a0` |

---

## 3. Typography

### 3.1 Font Families

```css
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
```

### 3.2 Font Sizes

| Token         | Size | Line Height | Usage          |
| ------------- | ---- | ----------- | -------------- |
| `--text-xs`   | 11px | 1.4         | Small labels   |
| `--text-sm`   | 13px | 1.4         | Secondary text |
| `--text-base` | 14px | 1.5         | Body text      |
| `--text-lg`   | 16px | 1.5         | Headings       |
| `--text-xl`   | 18px | 1.4         | Page titles    |
| `--text-2xl`  | 24px | 1.3         | Large headings |

### 3.3 Font Weights

| Token             | Weight | Usage           |
| ----------------- | ------ | --------------- |
| `--font-normal`   | 400    | Body text       |
| `--font-medium`   | 500    | Medium emphasis |
| `--font-semibold` | 600    | Headings        |
| `--font-bold`     | 700    | Strong emphasis |

---

## 4. Spacing System

### 4.1 Spacing Scale

| Token        | Value |
| ------------ | ----- |
| `--space-0`  | 0     |
| `--space-1`  | 4px   |
| `--space-2`  | 8px   |
| `--space-3`  | 12px  |
| `--space-4`  | 16px  |
| `--space-5`  | 20px  |
| `--space-6`  | 24px  |
| `--space-8`  | 32px  |
| `--space-10` | 40px  |

### 4.2 Layout Spacing

| Token             | Value    | Usage              |
| ----------------- | -------- | ------------------ |
| `--panel-padding` | 12px     | Panel content      |
| `--section-gap`   | 16px     | Between sections   |
| `--item-gap`      | 8px      | Between list items |
| `--input-padding` | 8px 12px | Input fields       |

---

## 5. Components

### 5.1 Buttons

```css
/* Base Button */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 500;
  border-radius: 6px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.15s ease;
}

/* Primary */
.btn-primary {
  background: #5b8def;
  color: #fff;
}
.btn-primary:hover {
  background: #6b9fff;
}

/* Secondary */
.btn-secondary {
  background: #2d2d2d;
  border-color: #404040;
  color: #e0e0e0;
}
.btn-secondary:hover {
  background: #383838;
  border-color: #4a4a4a;
}

/* Ghost */
.btn-ghost {
  background: transparent;
  color: #a0a0a0;
}
.btn-ghost:hover {
  background: #2d2d2d;
  color: #e0e0e0;
}

/* Icon Button */
.btn-icon {
  padding: 8px;
  min-width: 32px;
  min-height: 32px;
}

/* Disabled */
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

### 5.2 Inputs

```css
/* Base Input */
.input {
  width: 100%;
  padding: 8px 12px;
  font-size: 14px;
  color: #e0e0e0;
  background: #171717;
  border: 1px solid #404040;
  border-radius: 6px;
  outline: none;
  transition: border-color 0.15s ease;
}
.input:focus {
  border-color: #5b8def;
}
.input::placeholder {
  color: #6b6b6b;
}

/* Select */
.select {
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23a0a0a0' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 36px;
}

/* Textarea */
.textarea {
  min-height: 100px;
  resize: vertical;
}
```

### 5.3 Cards

```css
.card {
  background: #252525;
  border: 1px solid #333333;
  border-radius: 8px;
  padding: 16px;
}
.card:hover {
  border-color: #404040;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.card-title {
  font-size: 14px;
  font-weight: 600;
  color: #e0e0e0;
}
```

### 5.4 Panels

```css
/* Sidebar */
.sidebar {
  background: #1e1e1e;
  border-right: 1px solid #333333;
  width: 240px;
  height: 100%;
}

/* Context Panel */
.context-panel {
  background: #1e1e1e;
  border-left: 1px solid #333333;
  width: 320px;
}

/* Tab Panel */
.panel {
  background: #252525;
  border-radius: 8px;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  border-bottom: 1px solid #333333;
  background: #2d2d2d;
}
```

### 5.5 Tabs

```css
.tabs {
  display: flex;
  gap: 4px;
  padding: 4px;
  background: #171717;
  border-radius: 6px;
}

.tab {
  padding: 6px 12px;
  font-size: 13px;
  color: #a0a0a0;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.tab:hover {
  color: #e0e0e0;
}
.tab.active {
  background: #2d2d2d;
  color: #e0e0e0;
}
```

### 5.6 Badges

```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 500;
  border-radius: 4px;
}

/* Status badges */
.badge-draft {
  background: #2d2d2d;
  color: #a0a0a0;
}
.badge-running {
  background: #3d5a9e;
  color: #8ab4ff;
}
.badge-success {
  background: #1f3d1f;
  color: #4ade80;
}
.badge-warning {
  background: #3d3a1f;
  color: #fbbf24;
}
.badge-error {
  background: #3d1f1f;
  color: #f87171;
}
.badge-approved {
  background: #1f2d1f;
  color: #4ade80;
}
```

### 5.7 List Items

```css
.list-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  color: #a0a0a0;
  cursor: pointer;
  transition: all 0.15s ease;
}
.list-item:hover {
  background: #2d2d2d;
  color: #e0e0e0;
}
.list-item.active {
  background: #383838;
  color: #e0e0e0;
  border-left: 2px solid #5b8def;
}

.list-item-icon {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.list-item-content {
  flex: 1;
  min-width: 0;
}

.list-item-title {
  font-size: 14px;
  color: inherit;
}

.list-item-subtitle {
  font-size: 12px;
  color: #6b6b6b;
}
```

### 5.8 Modals

```css
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: #252525;
  border: 1px solid #404040;
  border-radius: 12px;
  min-width: 400px;
  max-width: 90vw;
  max-height: 90vh;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #333333;
}

.modal-title {
  font-size: 16px;
  font-weight: 600;
  color: #e0e0e0;
}

.modal-body {
  padding: 20px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid #333333;
}
```

### 5.9 Dropdown Menu

```css
.menu {
  background: #252525;
  border: 1px solid #404040;
  border-radius: 8px;
  padding: 4px;
  min-width: 180px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  font-size: 13px;
  color: #a0a0a0;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.1s ease;
}
.menu-item:hover {
  background: #383838;
  color: #e0e0e0;
}
.menu-item.active {
  background: #5b8def;
  color: #fff;
}

.menu-separator {
  height: 1px;
  background: #333333;
  margin: 4px 0;
}
```

---

## 6. Layout Patterns

### 6.1 Shell Layout

```css
.shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #1e1e1e;
  color: #e0e0e0;
}

.shell-main {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.shell-content {
  flex: 1;
  overflow: auto;
  background: #171717;
}

/* Menu Bar */
.menu-bar {
  height: 48px;
  background: #252525;
  border-bottom: 1px solid #333333;
  display: flex;
  align-items: center;
  padding: 0 12px;
}

/* Sidebar */
.sidebar {
  width: 240px;
  flex-shrink: 0;
  background: #1e1e1e;
  border-right: 1px solid #333333;
  display: flex;
  flex-direction: column;
}

.sidebar.collapsed {
  width: 56px;
}

/* Context Panel */
.context-panel {
  width: 320px;
  flex-shrink: 0;
  background: #1e1e1e;
  border-left: 1px solid #333333;
}

/* Bottom Dock */
.bottom-dock {
  height: 48px;
  background: #252525;
  border-top: 1px solid #333333;
}
```

### 6.2 List + Detail Layout

```css
.list-detail {
  display: flex;
  height: 100%;
}

.list-detail-list {
  width: 280px;
  flex-shrink: 0;
  background: #1e1e1e;
  border-right: 1px solid #333333;
  display: flex;
  flex-direction: column;
}

.list-detail-detail {
  flex: 1;
  background: #171717;
  overflow: auto;
}
```

---

## 7. Special Elements

### 7.1 Progress Bar

```css
.progress {
  height: 6px;
  background: #333333;
  border-radius: 3px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: #5b8def;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.progress-bar.success {
  background: #4ade80;
}

.progress-bar.warning {
  background: #fbbf24;
}

.progress-bar.error {
  background: #f87171;
}
```

### 7.2 Tooltips

```css
.tooltip {
  position: relative;
}

.tooltip::after {
  content: attr(data-tooltip);
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  padding: 6px 10px;
  font-size: 12px;
  color: #e0e0e0;
  background: #383838;
  border-radius: 4px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
}

.tooltip:hover::after {
  opacity: 1;
}
```

### 7.3 Scrollbar

```css
/* Custom scrollbar for webkit */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #171717;
}

::-webkit-scrollbar-thumb {
  background: #333333;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #404040;
}
```

### 7.4 Loading Spinner

```css
.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid #333333;
  border-top-color: #5b8def;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
```

---

## 8. States

### 8.1 Hover States

```css
.hover-lift:hover {
  transform: translateY(-1px);
}

.hover-bright:hover {
  filter: brightness(1.1);
}
```

### 8.2 Focus States

```css
.focus-ring:focus {
  outline: none;
  box-shadow: 0 0 0 2px #5b8def40;
}
```

### 8.3 Active/Selected States

```css
.selected {
  background: #383838;
  border-color: #5b8def;
}
```

---

## 9. Tailwind Configuration

### 9.1 Tailwind Config Override

```javascript
// tailwind.config.js
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Base
        bg: {
          base: '#1e1e1e',
          elevated: '#252525',
          hover: '#2d2d2d',
          active: '#383838',
          input: '#171717',
        },
        // Borders
        border: {
          DEFAULT: '#404040',
          light: '#333333',
          focus: '#5b8def',
        },
        // Text
        text: {
          primary: '#e0e0e0',
          secondary: '#a0a0a0',
          muted: '#6b6b6b',
          accent: '#5b8def',
        },
        // Accent
        accent: {
          DEFAULT: '#5b8def',
          hover: '#6b9fff',
          muted: '#3d5a9e',
        },
        // Status
        success: '#4ade80',
        warning: '#fbbf24',
        error: '#f87171',
        purple: '#a78bfa',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        xs: ['11px', '1.4'],
        sm: ['13px', '1.4'],
        base: ['14px', '1.5'],
        lg: ['16px', '1.5'],
        xl: ['18px', '1.4'],
        '2xl': ['24px', '1.3'],
      },
      spacing: {
        0: '0',
        1: '4px',
        2: '8px',
        3: '12px',
        4: '16px',
        5: '20px',
        6: '24px',
        8: '32px',
        10: '40px',
      },
      borderRadius: {
        DEFAULT: '6px',
        lg: '8px',
        xl: '12px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(0, 0, 0, 0.3)',
        DEFAULT: '0 2px 4px rgba(0, 0, 0, 0.3)',
        lg: '0 4px 8px rgba(0, 0, 0, 0.3)',
        xl: '0 8px 24px rgba(0, 0, 0, 0.4)',
      },
    },
  },
  plugins: [],
};
```

---

## 10. Usage Guidelines

### 10.1 Class Naming Convention

```tsx
// Buttons
<button className="btn btn-primary">Action</button>
<button className="btn btn-secondary">Cancel</button>
<button className="btn btn-ghost">Link</button>

// Inputs
<input className="input" placeholder="Search..." />
<select className="input select">...</select>

// Cards
<div className="card">
  <div className="card-header">
    <span className="card-title">Title</span>
  </div>
</div>

// List items
<div className="list-item active">
  <span className="list-item-icon">📄</span>
  <span className="list-item-title">Item</span>
</div>

// Badges
<span className="badge badge-success">Complete</span>
<span className="badge badge-running">Running</span>
```

### 10.2 Component Patterns

```tsx
// Use consistent spacing
<div className="p-3">...</div>

// Use semantic colors
<div className="text-text-secondary">...</div>
<div className="bg-bg-elevated">...</div>

// Use state classes
<button className="btn btn-primary hover:bg-accent-hover">...</button>
<div className="border border-border focus:border-border-focus">...</div>
```

---

## 11. Migration Checklist

### Phase 1: Core Components

- [ ] Update Button component with ComfyUI styles
- [ ] Update Input/Select components
- [ ] Update Card component
- [ ] Update Badge component
- [ ] Update List Item component

### Phase 2: Layout Components

- [ ] Update Shell layout (dark theme)
- [ ] Update Sidebar (dark)
- [ ] Update TopToolbar
- [ ] Update Context Panel
- [ ] Update Activity Dock

### Phase 3: Page Updates

- [ ] Update Home Page
- [ ] Update Project pages
- [ ] Update Workflow page
- [ ] Update Shots page
- [ ] Update Timeline page

### Phase 4: Polish

- [ ] Add scrollbar styles
- [ ] Add transition utilities
- [ ] Verify all states
- [ ] Test accessibility
