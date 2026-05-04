# Replacing QlikView Macros and Triggers

QlikView relied heavily on VBScript macros and document/sheet triggers for interactivity. Qlik Sense replaces these with native features, extensions, and Application Automation.

## Triggers

### 1. OnOpen / OnActivateSheet (Pre-selections)
**QlikView:** Document properties → Triggers → OnOpen → Select in Field 'Year' = 2024
**Qlik Sense:**
- **App Bookmarks:** Create a bookmark with the default selections, set it as the **Default Bookmark** for the app.
- **URL Parameters:** When linking to an app, append `&select=Year,2024`.

### 2. OnAnySelect (Dynamic Variables)
**QlikView:** Trigger → OnAnySelect → Set Variable `vSelectedCount` = `=GetPossibleCount(Customer)`
**Qlik Sense:**
- Variables evaluate globally. Define `vSelectedCount` = `=GetPossibleCount(Customer)` in the variable dialog, and it will update automatically without a trigger.

### 3. Clear All Selections Button
**QlikView:** Button object → Action: Clear All
**Qlik Sense:**
- Use the native **Button** object (Dashboard bundle) → Actions and navigation → Clear all selections.

### 4. Navigate to Sheet
**QlikView:** Button object → Action: Activate Sheet
**Qlik Sense:**
- Use the **Button** object → Actions and navigation → Navigate to a specific sheet.

## VBScript Macros

### 1. Exporting Data to Excel
**QlikView Macro:**
```vbscript
sub ExportToExcel
    set obj = ActiveDocument.GetSheetObject("CH01")
    obj.ExportBiff "C:\Temp\Export.xls"
end sub
```
**Qlik Sense Alternatives:**
- **Native:** Right-click chart → Download as... → Data.
- **Button:** Button object → Actions → Export data (select the chart ID).
- **Automation:** Qlik Application Automation can generate and email Excel reports on a schedule.

### 2. Reloading the Application
**QlikView Macro:**
```vbscript
sub ReloadApp
    ActiveDocument.DoReload
end sub
```
**Qlik Sense Alternatives:**
- **Button:** Button object → Actions → Reload app (Note: only works if user has reload permissions and app is in a personal/shared space).
- **Qlik Application Automation:** Trigger a reload task via a webhook or scheduled automation.

### 3. Loop and Reduce (Dynamic Document Generation)
**QlikView Macro:** Looping through a field, selecting each value, and saving a new `.qvw`.
**Qlik Sense Alternatives:**
- **Qlik Cloud:** Qlik Application Automation (Loop over field values, apply selection, export PDF/PowerPoint, email).
- **Qlik NPrinting:** Enterprise reporting and distribution tool.
- **Section Access:** Use strict data reduction instead of generating physical copies of the app.

### 4. Dynamic Show/Hide Objects
**QlikView Macro:** Setting properties to hide objects based on variables.
**Qlik Sense Alternatives:**
- Chart Properties → Add-ons → Data handling → **Show condition**. (e.g., `vShowChart = 1`)
- **Container Object:** Use the native container with show conditions on the tabs to swap charts dynamically.

### 5. Writing Back to Database
**QlikView Macro:** Connecting to ADO/OLEDB and executing `INSERT` or `UPDATE`.
**Qlik Sense Alternatives:**
- **Extensions:** Use certified Writeback extensions (e.g., Inphinity).
- **Qlik Application Automation:** Button triggers a webhook → Automation writes to REST API / Database.
- **REST Connector POST:** During reload, use the REST connector with `METHOD "POST"` (requires full app reload).

## Missing QlikView Features (Workarounds)

### Cyclic Groups
Qlik Sense does not have native cyclic groups.
**Workaround:** Alternative Dimensions. In chart properties, add multiple dimensions and check "Alternative". Users can switch dimensions via the UI arrow.

### Input Boxes (Variable Entry)
**Workaround:** Custom Objects → Qlik Dashboard bundle → **Variable input**. Allows drop-downs, sliders, and text input linked to a variable.

### Always One Selected Value
**QlikView:** Field property.
**Qlik Sense:**
- In the data load editor, you can't enforce this.
- In the UI, add a **Filter pane** → Field settings → check "Always one selected value". (Must be set up on every sheet where the filter pane exists).
