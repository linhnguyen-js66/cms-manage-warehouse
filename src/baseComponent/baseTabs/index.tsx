import React from 'react';
import { Box, Tab } from '@mui/material';
import { TabContext, TabList } from '@mui/lab';

interface CustomTabProps {
  value: string;
  handleChange: (event: React.SyntheticEvent, newValue: string) => void;
  labels: string[];
}

const CustomTab: React.FC<CustomTabProps> = ({ value, handleChange, labels }) => {
  return (
    <Box sx={{ width: "100%", typography: "body1" }}>
      <TabContext value={value}>
        <Box sx={{ borderBottom: 1, borderColor: "divider", marginBottom:"20px" }}>
          <TabList
            sx={{
              "& .MuiTabs-flexContainer": {
                alignItems: "center",
              },
              "& .MuiTabs-indicator": {
                backgroundColor: "#57d4e6",
              },
            }}
            onChange={handleChange}
          >
            {labels.map((label, index) => (
              <Tab
                key={index}
                sx={{
                  fontSize: 12,
                  textTransform: "none",
                  color: "#000000",
                  "&.Mui-selected": {
                    color: "#57d4e6",
                    borderRadius: "20px",
                    height: "34px",
                    minHeight: "34px",
                    transition: "transform 0.3s ease-in-out",
                  },
                }}
                label={label}
                value={(index + 1).toString()}
              />
            ))}
          </TabList>
        </Box>
      </TabContext>
    </Box>
  );
};

export default CustomTab;
