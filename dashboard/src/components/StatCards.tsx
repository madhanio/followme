import React from 'react';

export interface StatCardsProps {
  totalProfiles: number;
  followed: number;
  mutuals: number;
  skipped: number;
}

export function StatCards({
  totalProfiles,
  followed,
  mutuals,
  skipped,
}: StatCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3.5">
      {/* EVALUATED PROFILES */}
      <div className="bg-[#f8f9fa] dark:bg-[#1a1a1c] border border-[#eeeeee] dark:border-[#2a2a2a] p-4 rounded-[20px] text-center flex flex-col justify-center">
        <span className="text-3xl font-extrabold text-[#e60023] font-mono leading-none">{totalProfiles}</span>
        <span className="text-[9px] uppercase font-bold tracking-wider text-[#767676] mt-2 block">Evaluated</span>
      </div>
      {/* FOLLOWED */}
      <div className="bg-[#f8f9fa] dark:bg-[#1a1a1c] border border-[#eeeeee] dark:border-[#2a2a2a] p-4 rounded-[20px] text-center flex flex-col justify-center">
        <span className="text-3xl font-extrabold text-[#e60023] font-mono leading-none">{followed}</span>
        <span className="text-[9px] uppercase font-bold tracking-wider text-[#767676] mt-2 block">Followed</span>
      </div>
      {/* MUTUALS */}
      <div className="bg-[#f8f9fa] dark:bg-[#1a1a1c] border border-[#eeeeee] dark:border-[#2a2a2a] p-4 rounded-[20px] text-center flex flex-col justify-center">
        <span className="text-3xl font-extrabold text-[#e60023] font-mono leading-none">{mutuals}</span>
        <span className="text-[9px] uppercase font-bold tracking-wider text-[#767676] mt-2 block">Mutuals</span>
      </div>
      {/* SKIPPED */}
      <div className="bg-[#f8f9fa] dark:bg-[#1a1a1c] border border-[#eeeeee] dark:border-[#2a2a2a] p-4 rounded-[20px] text-center flex flex-col justify-center">
        <span className="text-3xl font-extrabold text-[#e60023] font-mono leading-none">{skipped}</span>
        <span className="text-[9px] uppercase font-bold tracking-wider text-[#767676] mt-2 block">Skipped</span>
      </div>
    </div>
  );
}
