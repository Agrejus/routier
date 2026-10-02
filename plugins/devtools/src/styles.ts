import { chromeStyles } from "./styles/chrome";
import { dataStyles } from "./styles/data";
import { queryStyles } from "./styles/queries";
import { themeStyles } from "./styles/theme";

export const devtoolsStyles = themeStyles + chromeStyles + dataStyles + queryStyles;
