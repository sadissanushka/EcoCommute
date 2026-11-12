'use client';

import React, { useState } from 'react';
import {
  Users,
  Search,
  Filter,
  Download,
  UserPlus,
  Building,
  Bus,
  Car,
  CheckCircle2,
} from 'lucide-react';

export default function EmployeeDirectoryPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');

  const employees = [
    {
      id: 'EMP-1042',
      name: 'Sarah Jenkins',
      email: 'sarah.j@dialog.lk',
      department: 'Engineering & IT',
      homeHub: 'Malabe Tech Horizon',
      preferredMode: 'Shuttle Express',
      seatHold: '12A (Assigned)',
      co2AvoidedKg: '142.4 kg',
      status: 'Active Commuter',
    },
    {
      id: 'EMP-1088',
      name: 'Dinesh Perera',
      email: 'dinesh.p@dialog.lk',
      department: 'Product & UX',
      homeHub: 'Moratuwa UoM Hub',
      preferredMode: 'Carpool Host',
      seatHold: 'Driver (3 seats)',
      co2AvoidedKg: '210.8 kg',
      status: 'Active Driver',
    },
    {
      id: 'EMP-1102',
      name: 'Kavindi Silva',
      email: 'kavindi.s@dialog.lk',
      department: 'Operations',
      homeHub: 'Kaduwela Interchange',
      preferredMode: 'Shuttle Express',
      seatHold: '04B (Assigned)',
      co2AvoidedKg: '98.5 kg',
      status: 'Active Commuter',
    },
    {
      id: 'EMP-1145',
      name: 'Nuwan Jayasinghe',
      email: 'nuwan.j@dialog.lk',
      department: 'Finance & Accounts',
      homeHub: 'Rajagiriya Hub',
      preferredMode: 'Carpool Rider',
      seatHold: 'Passenger',
      co2AvoidedKg: '82.0 kg',
      status: 'Active Commuter',
    },
    {
      id: 'EMP-1190',
      name: 'Amara Weerasinghe',
      email: 'amara.w@dialog.lk',
      department: 'Human Resources',
      homeHub: 'Cinnamon Gardens',
      preferredMode: 'Shuttle Express',
      seatHold: '08A (Assigned)',
      co2AvoidedKg: '115.2 kg',
      status: 'Active Commuter',
    },
  ];

  const filtered = employees.filter((emp) => {
    const matchSearch =
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchDept = selectedDept === 'ALL' || emp.department === selectedDept;
    return matchSearch && matchDept;
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-[#e0dedd] dark:border-[#272c29]">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-on-surface dark:text-white">
              Employee Directory & Transit Roster
            </h1>
            <span className="text-xs bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-full font-semibold">
              Q3 Active Roster
            </span>
          </div>
          <p className="text-sm text-on-surface-variant dark:text-[#a6b2a3] mt-1">
            Real-time commute allocations, sustainability contributions, and multimodal hub assignments.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-surface-container-low dark:bg-[#1d211e] border border-[#e4e2e1] dark:border-[#2c332e] text-on-surface dark:text-white text-xs font-semibold rounded-xl hover:bg-surface-container-high dark:hover:bg-[#252b27] transition">
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-container text-on-primary text-xs font-semibold rounded-xl shadow-sm transition">
            <UserPlus className="w-4 h-4" />
            <span>Enroll Employee</span>
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-surface-container-lowest dark:bg-[#1d211e] border border-[#e4e2e1] dark:border-[#2c332e] p-6 rounded-2xl shadow-sm">
          <div className="flex justify-between items-start text-xs font-semibold uppercase text-on-surface-variant dark:text-[#a6b2a3]">
            <span>Total Enrolled</span>
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div className="mt-4 text-3xl font-bold text-on-surface dark:text-white">3,420</div>
          <div className="text-xs text-primary font-semibold mt-2">+8% MoM enrollment</div>
        </div>

        <div className="bg-surface-container-lowest dark:bg-[#1d211e] border border-[#e4e2e1] dark:border-[#2c332e] p-6 rounded-2xl shadow-sm">
          <div className="flex justify-between items-start text-xs font-semibold uppercase text-on-surface-variant dark:text-[#a6b2a3]">
            <span>Daily Commuters</span>
            <Bus className="w-5 h-5 text-secondary" />
          </div>
          <div className="mt-4 text-3xl font-bold text-secondary">1,890</div>
          <div className="text-xs text-on-surface-variant dark:text-[#a6b2a3] mt-2">55.2% daily active load</div>
        </div>

        <div className="bg-surface-container-lowest dark:bg-[#1d211e] border border-[#e4e2e1] dark:border-[#2c332e] p-6 rounded-2xl shadow-sm">
          <div className="flex justify-between items-start text-xs font-semibold uppercase text-on-surface-variant dark:text-[#a6b2a3]">
            <span>Transit Split</span>
            <Car className="w-5 h-5 text-primary" />
          </div>
          <div className="mt-4 text-3xl font-bold text-on-surface dark:text-white">64% / 36%</div>
          <div className="text-xs text-on-surface-variant dark:text-[#a6b2a3] mt-2">Shuttle vs Carpool</div>
        </div>

        <div className="bg-surface-container-lowest dark:bg-[#1d211e] border border-[#e4e2e1] dark:border-[#2c332e] p-6 rounded-2xl shadow-sm">
          <div className="flex justify-between items-start text-xs font-semibold uppercase text-on-surface-variant dark:text-[#a6b2a3]">
            <span>Monthly Transit Subsidy</span>
            <Building className="w-5 h-5 text-primary" />
          </div>
          <div className="mt-4 text-3xl font-bold text-primary">Rs. 964,250</div>
          <div className="text-xs text-on-surface-variant dark:text-[#a6b2a3] mt-2">Fully balanced on ledger</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-80 bg-surface-container-low dark:bg-[#1d211e] px-3.5 py-2 rounded-xl border border-[#e4e2e1] dark:border-[#2c332e]">
          <Search className="w-4 h-4 text-on-surface-variant dark:text-[#a6b2a3]" />
          <input
            type="text"
            placeholder="Search employee by name, ID or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent w-full text-xs outline-none text-on-surface dark:text-white placeholder:text-on-surface-variant dark:placeholder:text-[#7f8b7c]"
          />
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <span className="text-xs text-on-surface-variant dark:text-[#a6b2a3]">Department:</span>
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="px-3 py-1.5 bg-surface-container-low dark:bg-[#1d211e] border border-[#e4e2e1] dark:border-[#2c332e] rounded-xl text-xs font-semibold outline-none text-on-surface dark:text-white"
          >
            <option value="ALL">All Departments</option>
            <option value="Engineering & IT">Engineering & IT</option>
            <option value="Product & UX">Product & UX</option>
            <option value="Operations">Operations</option>
            <option value="Finance & Accounts">Finance & Accounts</option>
            <option value="Human Resources">Human Resources</option>
          </select>
        </div>
      </div>

      {/* Roster Table */}
      <div className="bg-surface-container-lowest dark:bg-[#1d211e] border border-[#e4e2e1] dark:border-[#2c332e] rounded-2xl p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#e0dedd] dark:border-[#272c29] text-xs uppercase font-semibold text-on-surface-variant dark:text-[#a6b2a3]">
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Home Transit Hub</th>
                <th className="py-3 px-4">Transit Mode</th>
                <th className="py-3 px-4">Seat / Role</th>
                <th className="py-3 px-4">CO₂ Avoided</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e0dedd] dark:divide-[#272c29]">
              {filtered.map((emp) => (
                <tr key={emp.id} className="hover:bg-surface-container-low dark:hover:bg-[#252b27] transition">
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-on-surface dark:text-white">{emp.name}</div>
                    <div className="text-xs text-on-surface-variant dark:text-[#a6b2a3]">{emp.id} &bull; {emp.email}</div>
                  </td>
                  <td className="py-3.5 px-4 font-medium text-on-surface dark:text-white">{emp.department}</td>
                  <td className="py-3.5 px-4 text-xs text-on-surface-variant dark:text-[#a6b2a3]">{emp.homeHub}</td>
                  <td className="py-3.5 px-4 font-semibold text-on-surface dark:text-white">{emp.preferredMode}</td>
                  <td className="py-3.5 px-4 font-mono text-xs text-on-surface dark:text-white">{emp.seatHold}</td>
                  <td className="py-3.5 px-4 font-semibold text-primary">{emp.co2AvoidedKg}</td>
                  <td className="py-3.5 px-4">
                    <span className="text-xs bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 rounded-md font-semibold">
                      {emp.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
