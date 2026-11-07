import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import Image from "next/image";
import styles from "../../auth.module.css";
import { AUTH_ROUTES } from "@/domains/auth/config/auth-routes";

export default function SignUpPage() {
  return (
    <section className={styles.page}>
      <div className={styles.content}>
        <Link href={AUTH_ROUTES.HOME} className={styles.logo}>
          <Image
            src="/assets/NutriSea%20by%20Shopeefood.png"
            alt="NutriSea by ShopeeFood"
            width={240}
            height={64}
            priority
          />
        </Link>
        <h1>Buat akun NutriSea</h1>
        <p>Daftar akun baru dan pilih persona gizi harianmu untuk personalisasi menu ShopeeFood.</p>
        <SignUp
          routing="path"
          path={AUTH_ROUTES.SIGN_UP}
          signInUrl={AUTH_ROUTES.SIGN_IN}
          fallbackRedirectUrl={AUTH_ROUTES.PERSONA_SELECTION}
          appearance={{
            variables: {
              colorPrimary: "#EE4D2D",
              colorBackground: "#FFFFFF",
              borderRadius: "10px",
            },
            elements: {
              card: styles.clerkCard,
              headerTitle: styles.clerkTitle,
              formButtonPrimary: styles.clerkButton,
            },
          }}
        />
      </div>
    </section>
  );
}
