
import React from 'react';
import { Delete, Check } from 'lucide-react';

interface NumPadProps {
    onNumber: (num: string) => void;
    onDelete: () => void;
    onClear: () => void;
    onDone: () => void;
    className?: string;
}

const NumPad: React.FC<NumPadProps> = ({ onNumber, onDelete, onClear, onDone, className = '' }) => {
    const btnClass = "h-14 rounded-xl text-2xl font-medium sf-control active:opacity-70 transition-all text-white flex items-center justify-center";

    return (
        <div className={`grid grid-cols-4 gap-3 p-4 sf-surface border-t sf-divider ${className}`}>
            <button onClick={() => onNumber('7')} className={btnClass}>7</button>
            <button onClick={() => onNumber('8')} className={btnClass}>8</button>
            <button onClick={() => onNumber('9')} className={btnClass}>9</button>
            <button onClick={onDelete} className={`${btnClass} text-red-400 bg-red-500/10 hover:bg-red-500/20`}><Delete size={24} /></button>

            <button onClick={() => onNumber('4')} className={btnClass}>4</button>
            <button onClick={() => onNumber('5')} className={btnClass}>5</button>
            <button onClick={() => onNumber('6')} className={btnClass}>6</button>
            <button onClick={onClear} className={`${btnClass} text-sm font-bold text-gray-400`}>AC</button>

            <button onClick={() => onNumber('1')} className={btnClass}>1</button>
            <button onClick={() => onNumber('2')} className={btnClass}>2</button>
            <button onClick={() => onNumber('3')} className={btnClass}>3</button>
            <button onClick={onDone} className={`${btnClass} row-span-2 bg-primary hover:bg-primary/90 text-white`}><Check size={32} /></button>

            <button onClick={() => onNumber('0')} className={`${btnClass} col-span-2`}>0</button>
            <button onClick={() => onNumber('.')} className={btnClass}>.</button>
        </div>
    );
};

export default NumPad;
