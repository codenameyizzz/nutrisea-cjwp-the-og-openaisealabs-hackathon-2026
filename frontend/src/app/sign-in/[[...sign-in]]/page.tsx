import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import Image from "next/image";
import styles from "../../auth.module.css";
import { AUTH_ROUTES } from "@/domains/auth/config/auth-routes";

export default function SignInPage() {
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
        <h1>Welcome back</h1>
        <p>Sign in to find food that fits your preferences.</p>
        <SignIn
          routing="path"
          path={AUTH_ROUTES.SIGN_IN}
          signUpUrl={AUTH_ROUTES.SIGN_UP}
          fallbackRedirectUrl={AUTH_ROUTES.DASHBOARD}
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
              formFieldInput: styles.clerkInput,
              socialButtonsBlockButton: styles.clerkSocialButton,
              formFieldInputShowPasswordButton: styles.clerkPasswordButton,
            },
          }}
        />
      </div>
    </section>
  );
}
