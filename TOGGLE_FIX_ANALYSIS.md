# Toggle/Widget Bug Analysis & Fix Tracking

## Issues Reported
1. **토글이 갑자기 많이 생성되고 다같이 꺼져 하나만 종료해도** - Widgets multiply, all close together when closing one
2. **토글에 아이디 입력이 따로 출력돼** - ID input appears separately in toggles

## Root Cause Analysis

### Bug 1: Widget close button closes ALL widgets (CRITICAL) - FIXED
- **File**: `frontend/src/app/widget/page.tsx` line 230-232
- **Problem**: `handleClose()` calls `sendToggleWidget()` which sends `widget:toggle` IPC
- **Effect**: `widget:toggle` handler in `main.ts` (line 441-451) toggles ALL widget windows together
- **Fix**: Added new `widget:close-self` IPC channel that closes ONLY the sender's window
- **Also Fixed**: `handleRemoveCategory()` at line 252 had the same bug - closing empty widget used `sendToggleWidget()`
- **Status**: FIXED

### Bug 2: Missing DialogDescription causes Radix UI rendering issues - FIXED
- **Files**: `Sidebar.tsx`, `AddLinkDialog.tsx`, `OptionsDialog.tsx`
- **Problem**: All `<Dialog>` usage lacked `<DialogDescription>`, causing Radix UI warnings
- **Effect**: In `@radix-ui/react-dialog@^1.1.15` + React 19, missing Description can cause accessibility wrapper elements to render visibly (explains "아이디 입력이 따로 출력돼")
- **Fix**: Added `<DialogDescription className="sr-only">` to all 4 dialogs
- **Status**: FIXED

### Bug 3: AddLinkDialog onOpenChange handler incorrect - FIXED
- **File**: `frontend/src/components/links/AddLinkDialog.tsx` line 89
- **Problem**: `onOpenChange={onClose}` - Radix calls this with boolean, but `onClose` ignores it
- **Effect**: When Radix calls `onOpenChange(true)` in edge cases, `onClose()` fires and CLOSES the dialog
- **Fix**: Changed to `onOpenChange={(open) => { if (!open) onClose(); }}`
- **Status**: FIXED

### Bug 4: Potential widget duplication via restoreWidgets()
- **File**: `frontend/electron/main.ts`
- **Problem**: `restoreWidgets()` called on initial load AND on window re-show
- **Guard**: `wasHidden && widgetWindows.size === 0` prevents double creation on re-show
- **Assessment**: Guard is correct; no fix needed
- **Status**: OK (MONITORED)

## Files Modified

| File | Change | Status |
|------|--------|--------|
| `electron/main.ts` | Add `widget:close-self` IPC handler | DONE |
| `electron/preload.ts` | Add `closeWidgetSelf()` function | DONE |
| `src/types/index.ts` | Add `closeWidgetSelf` to ElectronAPI interface | DONE |
| `src/app/widget/page.tsx` | Use `closeWidgetSelf()` in `handleClose()` and `handleRemoveCategory()` | DONE |
| `src/components/links/AddLinkDialog.tsx` | Fix `onOpenChange` handler + add `DialogDescription` | DONE |
| `src/components/layout/Sidebar.tsx` | Add `DialogDescription` to both dialogs | DONE |
| `src/components/layout/OptionsDialog.tsx` | Add `DialogDescription` | DONE |

## Verification
- TypeScript (Electron): NO ERRORS
- TypeScript (Frontend): NO ERRORS

## Architecture Notes

### Dialog Instances in App (4 total)
1. `Sidebar.tsx` - New Category Dialog (self-contained, `isOpen` state)
2. `Sidebar.tsx` - Edit Category Dialog (self-contained, `isEditOpen` state)
3. `OptionsDialog.tsx` - Settings Dialog (self-contained, `isOpen` state)
4. `AddLinkDialog.tsx` - Add/Edit Link Dialog (controlled via props from dashboard)

### Widget IPC Flow
- `widget:set-category` → Create or focus specific widget
- `widget:toggle` → Show/hide ALL widgets (for tray menu only)
- `widget:close` → Close ALL widgets (for logout)
- `widget:close-self` → NEW: Close only sender's widget (for X button)
