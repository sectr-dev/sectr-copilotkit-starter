import type { Metadata } from "next";
import { Providers } from "./providers";
import "@copilotkit/react-core/v2/styles.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sectr + CopilotKit starter",
  description: "A CopilotKit chat talking to an agent deployed on Sectr.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
