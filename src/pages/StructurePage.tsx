import { Card, Tabs } from 'antd';
import { ApartmentOutlined, ClusterOutlined, FundProjectionScreenOutlined } from '@ant-design/icons';
import { WellsPage } from '@/pages/WellsPage';
import { NgduPanel } from '@/components/structure/NgduPanel';
import { DepartmentsPanel } from '@/components/structure/DepartmentsPanel';

export function StructurePage() {
  return (
    <Tabs
      defaultActiveKey="wells"
      items={[
        {
          key: 'wells',
          label: (
            <span>
              <FundProjectionScreenOutlined /> Скважины
            </span>
          ),
          children: <WellsPage />,
        },
        {
          key: 'ngdu',
          label: (
            <span>
              <ClusterOutlined /> НГДУ
            </span>
          ),
          children: (
            <Card>
              <NgduPanel />
            </Card>
          ),
        },
        {
          key: 'departments',
          label: (
            <span>
              <ApartmentOutlined /> Цеха
            </span>
          ),
          children: (
            <Card>
              <DepartmentsPanel />
            </Card>
          ),
        },
      ]}
    />
  );
}
