import os
import configparser


# gets the config with the name matching the PYTHON_ENVIRONMENT environment variable
class ConfigLoader:
    @staticmethod
    def get_config():
        envkey = os.environ.get('PYTHON_ENVIRONMENT', None)
        config = configparser.ConfigParser(allow_no_value=True)

        configlist = ['config/globals.ini']

        if not envkey:
            configlist.append('config/config.local.ini')
        else:
            configlist.append('config/config.' + envkey + '.ini')

        config.read(configlist)
        return config
