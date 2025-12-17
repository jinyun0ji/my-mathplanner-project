import { createPortal } from 'react-dom';

const ModalPortal = ({ children }) => {
    const el = document.getElementById('modal-root') || document.body;
    return createPortal(children, el);
};

export default ModalPortal;