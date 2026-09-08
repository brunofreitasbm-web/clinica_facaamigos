export const theme = {
  colors: {
    primary: "#0284C7",
    primaryHover: "#0369A1",
    background: "#F8FAFC",
    surface: "#FFFFFF",
    textPrimary: "#1E293B",
    textSecondary: "#475569",
    border: "#CBD5E1",
    tab: {
      activeBg: "#0284C7",
      activeText: "#FFFFFF",
      inactiveBg: "#EAEAEA",
      inactiveText: "#424242",
      inactiveHoverBg: "#DCDCDC",
      inactiveHoverText: "#1F1F1F",
      inactiveBorder: "#CCCCCC",
      focusRing: "#0284C7",
    },
  },
};

export type Theme = typeof theme;
export default theme;
