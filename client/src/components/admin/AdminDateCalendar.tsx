import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DateCalendar } from "@mui/x-date-pickers/DateCalendar";
import dayjs from "dayjs";

interface AdminDateCalendarProps {
  value: Date;
  onChange: (next: Date) => void;
}

export default function AdminDateCalendar({ value, onChange }: AdminDateCalendarProps) {
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <DateCalendar
        value={dayjs(value)}
        onChange={(nextDate) => {
          if (nextDate) onChange(nextDate.toDate());
        }}
        sx={{
          width: 320,
          color: "hsl(var(--foreground))",
          bgcolor: "hsl(var(--background))",
          borderRadius: 2,
          "& .MuiPickersCalendarHeader-root": {
            px: 1.5,
            pt: 1.25,
          },
          "& .MuiPickersCalendarHeader-label": {
            fontSize: "0.88rem",
            fontWeight: 600,
            letterSpacing: "0.02em",
          },
          "& .MuiPickersArrowSwitcher-button": {
            color: "hsl(var(--foreground))",
            borderRadius: 9999,
            transition: "background-color 120ms ease",
            "&:hover": {
              bgcolor: "hsl(var(--muted))",
            },
          },
          "& .MuiDayCalendar-weekDayLabel": {
            color: "hsl(var(--muted-foreground))",
            fontSize: "0.72rem",
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          },
          "& .MuiPickersDay-root": {
            fontSize: "0.82rem",
            borderRadius: "9999px",
            color: "hsl(var(--foreground))",
            transition: "all 120ms ease",
            "&:hover": {
              bgcolor: "hsl(var(--muted))",
            },
            "&.Mui-selected": {
              bgcolor: "hsl(var(--primary))",
              color: "hsl(var(--primary-foreground))",
              "&:hover": {
                bgcolor: "hsl(var(--primary))",
              },
            },
            "&.MuiPickersDay-today:not(.Mui-selected)": {
              border: "1px solid hsl(var(--primary))",
              bgcolor: "hsl(var(--primary) / 0.08)",
            },
            "&.MuiPickersDay-dayOutsideMonth": {
              color: "hsl(var(--muted-foreground))",
              opacity: 0.45,
            },
          },
        }}
      />
    </LocalizationProvider>
  );
}
