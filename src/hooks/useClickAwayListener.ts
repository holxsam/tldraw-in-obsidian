import { useEffect, useRef } from "react";

export function useClickAwayListener<T extends HTMLElement>({
    enableClickAwayListener, handler,
}: {
    enableClickAwayListener: boolean,
    handler: () => void,
}) {
    const ref = useRef<T>(null);
    useEffect(() => {
        if(!enableClickAwayListener) return;

        const handleClickAway = (event: MouseEvent) => {
            if (event.target instanceof Node) {
                if (ref.current && !ref.current.contains(event.target)) {
                    handler()
                }
            }
        }
        document.addEventListener('pointerdown', handleClickAway);
        return () => {
            document.removeEventListener('pointerdown', handleClickAway);
        }
    }, [enableClickAwayListener, handler]);

    return ref;
}
