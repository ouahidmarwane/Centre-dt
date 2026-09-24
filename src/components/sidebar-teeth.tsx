import Image from "next/image";

import styles from "./sidebar-teeth.module.css";

// Decorative, blurred 3D teeth drifting behind the sidebar content.
export function SidebarTeeth() {
  return (
    <div aria-hidden="true" className={styles.layer}>
      {Array.from({ length: 6 }, (_, index) => (
        <Image alt="" className={styles.tooth} height={1254} key={index} sizes="120px" src="/images/floating-tooth.png" width={1254} />
      ))}
    </div>
  );
}
