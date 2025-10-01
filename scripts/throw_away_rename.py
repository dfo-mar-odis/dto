#this is a throw away script used to rename files to include the MPAZone id in a file name
import os
import re
from core import models

root_directory = r'./scripts/data/model_bottom_conditions_tables/'

def update_file_names(sub_dir, post_fix):

    directory = os.path.join(root_directory, sub_dir)
    files = [{'file_name': file, 'mpa_name': re.sub(post_fix, '', file).replace('_', ' ').replace('-', ' - ')} for file in os.listdir(directory) if os.path.isfile(os.path.join(directory, file))]

    for file in files:
        try:
            mpa = models.MPAZones.objects.get(name_e__icontains=f'{file['mpa_name'].strip()}')
            file['mpa_site'] = mpa.site_id
            match = re.search(post_fix, file['file_name'])
            idx = match.start() if match else None
            if idx:
                file['rename'] = f'{mpa.site_id}_' + file['file_name'][:idx] + file['file_name'][idx:]
                old_path = os.path.join(directory, file['file_name'])
                new_path = os.path.join(directory, file['rename'])
                os.rename(old_path, new_path)
            else:
                print('no idx found')

        except models.MPAZones.DoesNotExist:
            print(f"Could not find mpa matching: {file['mpa_name']}")

    print(files)
