# Calendar Generation Patterns

## Why a Master Calendar?

Without a continuous calendar, Qlik charts will have gaps for dates with no data. A master calendar ensures:
- Continuous date axes in charts
- Consistent time-based aggregations
- Reusable date attributes (Year, Month, Quarter, etc.)

## Standard Master Calendar

```qlik
// Step 1: Find date range from fact table
_DateRange:
LOAD
    Min(%DateKey) as MinDate,
    Max(%DateKey) as MaxDate
RESIDENT FactSales;

LET vMinDate = Peek('MinDate', 0, '_DateRange');
LET vMaxDate = Peek('MaxDate', 0, '_DateRange');
DROP TABLE _DateRange;

TRACE Calendar range: $(vMinDate) to $(vMaxDate);

// Step 2: Generate continuous dates
MasterCalendar:
LOAD
    TempDate as %DateKey,

    // Year
    Year(TempDate) as Year,
    
    // Quarter
    'Q' & Ceil(Month(TempDate) / 3) as Quarter,
    Year(TempDate) & '-Q' & Ceil(Month(TempDate) / 3) as YearQuarter,
    
    // Month
    Month(TempDate) as MonthName,
    Num(Month(TempDate)) as MonthNum,
    Date(MonthStart(TempDate), 'YYYY-MM') as YearMonth,
    
    // Week
    Week(TempDate) as WeekNum,
    Year(TempDate) & '-W' & Num(Week(TempDate), '00') as YearWeek,
    Date(WeekStart(TempDate), 'YYYY-MM-DD') as WeekStart,
    
    // Day
    Day(TempDate) as DayOfMonth,
    WeekDay(TempDate) as WeekDayNum,
    DayNumberOfYear(TempDate) as DayOfYear,
    
    // Labels
    Text(Date(TempDate, 'WWW')) as WeekDayName,
    If(WeekDay(TempDate) >= 5, 'Weekend', 'Weekday') as DayType,
    If(Month(TempDate) <= 6, 'H1', 'H2') as HalfYear
;
LOAD
    Date($(vMinDate) + IterNo() - 1) as TempDate
AUTOGENERATE 1
WHILE $(vMinDate) + IterNo() - 1 <= $(vMaxDate);

TRACE Calendar generated: $(NoOfRows('MasterCalendar')) days;
```

## Fiscal Calendar (Custom Year Start)

For organizations with fiscal years starting in a month other than January:

```qlik
SET vFiscalYearStartMonth = 7;  // July

MasterCalendar:
LOAD
    TempDate as %DateKey,
    
    // Standard calendar fields
    Year(TempDate) as CalendarYear,
    Month(TempDate) as MonthName,
    
    // Fiscal year (starts in July)
    If(Month(TempDate) >= $(vFiscalYearStartMonth),
        Year(TempDate) & '/' & Right(Year(TempDate) + 1, 2),
        Year(TempDate) - 1 & '/' & Right(Year(TempDate), 2)
    ) as FiscalYear,
    
    // Fiscal quarter
    'FQ' & Ceil(Mod(Month(TempDate) - $(vFiscalYearStartMonth) + 12, 12) / 3 + 0.01) as FiscalQuarter,
    
    // Fiscal month number (1 = first month of fiscal year)
    Mod(Month(TempDate) - $(vFiscalYearStartMonth) + 12, 12) + 1 as FiscalMonthNum
;
LOAD
    Date($(vMinDate) + IterNo() - 1) as TempDate
AUTOGENERATE 1
WHILE $(vMinDate) + IterNo() - 1 <= $(vMaxDate);
```

## Relative Date Flags

Add flags for common time comparisons:

```qlik
// Add to the MasterCalendar LOAD:

    // Relative flags (recalculated each reload)
    If(TempDate = Today(), 1, 0) as IsToday,
    If(TempDate >= MonthStart(Today()) AND TempDate <= Today(), 1, 0) as IsMTD,
    If(TempDate >= YearStart(Today()) AND TempDate <= Today(), 1, 0) as IsYTD,
    If(TempDate >= Today() - 7 AND TempDate <= Today(), 1, 0) as IsLast7Days,
    If(TempDate >= Today() - 30 AND TempDate <= Today(), 1, 0) as IsLast30Days,
    If(TempDate >= Today() - 365 AND TempDate <= Today(), 1, 0) as IsLast12Months,
    
    // Previous period flags (for comparison)
    If(Year(TempDate) = Year(Today()) - 1 AND
       DayNumberOfYear(TempDate) <= DayNumberOfYear(Today()), 1, 0) as IsPrevYTD,
    If(TempDate >= AddMonths(MonthStart(Today()), -1) AND
       TempDate < MonthStart(Today()), 1, 0) as IsPrevMonth,
```

## Multiple Date Roles

When your fact table has multiple dates (OrderDate, ShipDate, DueDate), create separate calendar instances:

```qlik
// Shared generation subroutine
SUB GenerateCalendar(vCalName, vKeyField, vMinD, vMaxD)

$(vCalName):
LOAD
    TempDate as $(vKeyField),
    Year(TempDate) as $(vCalName)_Year,
    Month(TempDate) as $(vCalName)_Month,
    Date(MonthStart(TempDate), 'YYYY-MM') as $(vCalName)_YearMonth,
    'Q' & Ceil(Month(TempDate) / 3) as $(vCalName)_Quarter
;
LOAD
    Date($(vMinD) + IterNo() - 1) as TempDate
AUTOGENERATE 1
WHILE $(vMinD) + IterNo() - 1 <= $(vMaxD);

END SUB

// Generate calendars for each date role
CALL GenerateCalendar('OrderCal', '%OrderDateKey', vMinOrderDate, vMaxOrderDate);
CALL GenerateCalendar('ShipCal', '%ShipDateKey', vMinShipDate, vMaxShipDate);
```

## Hour/Minute Calendar (Intraday)

For data with timestamps:

```qlik
TimeDimension:
LOAD
    Time(MakeTime(Hour, Minute)) as %TimeKey,
    Hour,
    Minute,
    If(Hour < 6, 'Night',
       If(Hour < 12, 'Morning',
          If(Hour < 18, 'Afternoon', 'Evening'))) as TimeOfDay,
    If(Hour >= 9 AND Hour < 17, 'Business Hours', 'Off Hours') as BusinessHours
;
LOAD
    Floor(RecNo() / 60) as Hour,
    Mod(RecNo(), 60) as Minute
AUTOGENERATE 1440;  // 24 hours × 60 minutes
```

## Tips

1. **Always link via a date key field** — use `%DateKey`, not separate Year/Month/Day fields
2. **Generate from fact data range** — don't hardcode dates
3. **Add padding** — extend a few months past your data range for forecasting
4. **Use `Dual()`** for sortable month names: `Dual(Month(TempDate), Num(Month(TempDate)))`
5. **Store as QVD** — if multiple apps use the same calendar, generate once and share
